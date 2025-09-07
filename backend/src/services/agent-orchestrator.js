/*
  agent-orchestrator.js
  Coordinates AI agents and Stacks blockchain interactions.

  Classes:
  - PaymentQueue: Redis-backed queue for payment requests
  - BlockchainConnector: Builds and broadcasts Stacks transactions
  - AgentSession: Handles agent auth/session lifecycle
  - TransactionMonitor: Subscribes to mempool/tx status (polling) and emits updates
  - AgentOrchestrator: Main service wiring queue, sessions, WS, and HTTP API

  Dependencies (install in backend/):
  - @stacks/transactions, @stacks/network, @stacks/auth
  - express, ws, redis, winston
*/

'use strict';

const express = require('express');
const { createClient } = require('redis');
const WebSocket = require('ws');
const winston = require('winston');
const {
  makeContractCall,
  broadcastTransaction,
  standardPrincipalCV,
  uintCV,
  stringAsciiCV,
  someCV,
  noneCV,
  cvToJSON,
} = require('@stacks/transactions');
const { StacksMainnet, StacksTestnet } = require('@stacks/network');

// Basic logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp, ...meta }) => `${timestamp} [${level}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`)
  ),
  transports: [new winston.transports.Console()],
});

// PaymentQueue manages enqueue/dequeue of payment requests in Redis
class PaymentQueue {
  constructor({ redisUrl, queueKey = 'agent:payments' }) {
    this.queueKey = queueKey;
    this.client = createClient({ url: redisUrl });
    this.connected = false;
  }

  async connect() {
    if (this.connected) return;
    this.client.on('error', (err) => logger.error(`Redis error: ${err.message}`));
    await this.client.connect();
    this.connected = true;
  }

  // Enqueue payment request
  async enqueue(request) {
    await this.connect();
    const payload = JSON.stringify(request);
    await this.client.lPush(this.queueKey, payload);
    logger.info('Enqueued payment request', { id: request.id, agentId: request.agentId });
  }

  // Blocking pop with timeout (seconds)
  async dequeueBlocking(timeoutSec = 5) {
    await this.connect();
    const res = await this.client.brPop(this.queueKey, timeoutSec);
    if (!res) return null;
    try {
      return JSON.parse(res.element);
    } catch (e) {
      logger.error('Failed to parse dequeued item', { e: e.message });
      return null;
    }
  }
}

// AgentSession handles simple token-based session management
class AgentSession {
  constructor() {
    this.sessions = new Map(); // token -> { agentId, issuedAt, expiresAt }
  }

  create(agentId, ttlSec = 3600) {
    const token = `${agentId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const now = Date.now();
    const sess = { agentId, issuedAt: now, expiresAt: now + ttlSec * 1000 };
    this.sessions.set(token, sess);
    return { token, ...sess };
  }

  verify(token) {
    const sess = this.sessions.get(token);
    if (!sess) return null;
    if (Date.now() > sess.expiresAt) {
      this.sessions.delete(token);
      return null;
    }
    return sess;
  }

  revoke(token) {
    this.sessions.delete(token);
  }
}

// BlockchainConnector wraps Stacks tx creation & broadcast
class BlockchainConnector {
  constructor({ network = 'testnet', senderKey, contractAddresses }) {
    this.network = network === 'mainnet' ? new StacksMainnet() : new StacksTestnet();
    this.senderKey = senderKey; // Hex-encoded private key
    this.contracts = {
      agentManager: contractAddresses?.agentManager, // { address, name }
      paymentProcessor: contractAddresses?.paymentProcessor, // { address, name }
    };
  }

  // Generic contract call
  async contractCall({ contractAddress, contractName, functionName, functionArgs, fee, nonce }) {
    const tx = await makeContractCall({
      contractAddress,
      contractName,
      functionName,
      functionArgs,
      senderKey: this.senderKey,
      network: this.network,
      fee,
      nonce,
    });
    const res = await broadcastTransaction(tx, this.network);
    const txId = typeof res === 'string' ? res : res?.txid;
    logger.info('Broadcasted contract call', { functionName, txId });
    return { txId, tx };
  }

  // Agent management wrappers
  async registerAgent({ agentId, permissions }) {
    const args = [standardPrincipalCV(agentId), this.listAsciiCV(permissions.slice(0, 10))];
    return this.contractCall({
      contractAddress: this.contracts.agentManager.address,
      contractName: this.contracts.agentManager.name,
      functionName: 'register-agent',
      functionArgs: args,
    });
  }

  async authorizeAgent({ agentId }) {
    const args = [standardPrincipalCV(agentId)];
    return this.contractCall({
      contractAddress: this.contracts.agentManager.address,
      contractName: this.contracts.agentManager.name,
      functionName: 'authorize-agent',
      functionArgs: args,
    });
  }

  async deauthorizeAgent({ agentId }) {
    const args = [standardPrincipalCV(agentId)];
    return this.contractCall({
      contractAddress: this.contracts.agentManager.address,
      contractName: this.contracts.agentManager.name,
      functionName: 'deauthorize-agent',
      functionArgs: args,
    });
  }

  async setSpendingLimit({ agentId, daily, monthly }) {
    const args = [standardPrincipalCV(agentId), uintCV(daily), uintCV(monthly)];
    return this.contractCall({
      contractAddress: this.contracts.agentManager.address,
      contractName: this.contracts.agentManager.name,
      functionName: 'set-spending-limit',
      functionArgs: args,
    });
  }

  async executePayment({ agentId, recipient, amount, memo }) {
    const args = [
      standardPrincipalCV(agentId),
      standardPrincipalCV(recipient),
      uintCV(amount),
      memo ? someCV(stringAsciiCV(memo.slice(0, 200))) : noneCV(),
    ];
    return this.contractCall({
      contractAddress: this.contracts.paymentProcessor.address,
      contractName: this.contracts.paymentProcessor.name,
      functionName: 'execute-payment',
      functionArgs: args,
    });
  }

  listAsciiCV(items) {
    const { listCV, stringAsciiCV } = require('@stacks/transactions');
    return listCV(items.map((s) => stringAsciiCV(s)));
  }
}

// TransactionMonitor: Polls tx status and emits events to WS
class TransactionMonitor {
  constructor({ network = 'testnet', wsServer }) {
    this.network = network;
    this.ws = wsServer; // instance of ws.Server
    this.subscribers = new Set();
  }

  attach(wsServer) {
    this.ws = wsServer;
  }

  notifyAll(event, payload) {
    if (!this.ws) return;
    const msg = JSON.stringify({ event, payload });
    this.ws.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(msg);
    });
  }
}

// AgentOrchestrator ties it together
class AgentOrchestrator {
  constructor({ redisUrl, stacks, senderKey, wsServer }) {
    this.queue = new PaymentQueue({ redisUrl });
    this.sessions = new AgentSession();
    this.monitor = new TransactionMonitor({ network: stacks?.network, wsServer });
    this.bc = new BlockchainConnector({
      network: stacks?.network,
      senderKey,
      contractAddresses: stacks?.contracts,
    });

    this.processing = false;
    this.router = express.Router();
    this.setupRoutes();
  }

  // Express API endpoints for agent management and payments
  setupRoutes() {
    // health
    this.router.get('/health', (req, res) => res.json({ ok: true }));

    // session management
    this.router.post('/session', express.json(), (req, res) => {
      const { agentId } = req.body || {};
      if (!agentId) return res.status(400).json({ error: 'agentId required' });
      const sess = this.sessions.create(agentId);
      res.json(sess);
    });

    // register agent
    this.router.post('/agents/register', express.json(), async (req, res) => {
      try {
        const { token, agentId, permissions = [] } = req.body || {};
        const sess = this.sessions.verify(token);
        if (!sess || sess.agentId !== agentId) return res.status(401).json({ error: 'invalid session' });
        const { txId } = await this.bc.registerAgent({ agentId, permissions });
        this.monitor.notifyAll('agent:registered', { agentId, txId });
        res.json({ txId });
      } catch (e) {
        logger.error('register failed', { e: e.message });
        res.status(500).json({ error: 'register_failed' });
      }
    });

    // authorize / deauthorize
    this.router.post('/agents/authorize', express.json(), async (req, res) => {
      try {
        const { token, agentId, action } = req.body || {};
        const sess = this.sessions.verify(token);
        if (!sess || sess.agentId !== agentId) return res.status(401).json({ error: 'invalid session' });
        const fn = action === 'deauthorize' ? this.bc.deauthorizeAgent.bind(this.bc) : this.bc.authorizeAgent.bind(this.bc);
        const { txId } = await fn({ agentId });
        this.monitor.notifyAll('agent:auth-changed', { agentId, action, txId });
        res.json({ txId });
      } catch (e) {
        logger.error('authorize failed', { e: e.message });
        res.status(500).json({ error: 'authorize_failed' });
      }
    });

    // set spending limits
    this.router.post('/agents/limits', express.json(), async (req, res) => {
      try {
        const { token, agentId, daily, monthly } = req.body || {};
        const sess = this.sessions.verify(token);
        if (!sess || sess.agentId !== agentId) return res.status(401).json({ error: 'invalid session' });
        const { txId } = await this.bc.setSpendingLimit({ agentId, daily, monthly });
        this.monitor.notifyAll('agent:limits', { agentId, daily, monthly, txId });
        res.json({ txId });
      } catch (e) {
        logger.error('limits failed', { e: e.message });
        res.status(500).json({ error: 'limits_failed' });
      }
    });

    // enqueue payment
    this.router.post('/payments', express.json(), async (req, res) => {
      try {
        const { token, agentId, recipient, amount, memo } = req.body || {};
        const sess = this.sessions.verify(token);
        if (!sess || sess.agentId !== agentId) return res.status(401).json({ error: 'invalid session' });
        const job = { id: `${Date.now()}`, agentId, recipient, amount, memo, attempts: 0 };
        await this.queue.enqueue(job);
        this.monitor.notifyAll('payment:queued', { agentId, jobId: job.id });
        res.json({ queued: true, jobId: job.id });
      } catch (e) {
        logger.error('enqueue failed', { e: e.message });
        res.status(500).json({ error: 'enqueue_failed' });
      }
    });
  }

  // Start background workers
  async start() {
    this.processing = true;
    this.processLoop().catch((e) => logger.error('processLoop error', { e: e.message }));
  }

  stop() {
    this.processing = false;
  }

  // Worker loop: pull jobs and execute on Stacks with retry
  async processLoop() {
    while (this.processing) {
      const job = await this.queue.dequeueBlocking(5);
      if (!job) continue;

      const maxAttempts = 5;
      const backoff = (n) => Math.min(30000, 500 * 2 ** n);

      try {
        await this.executeJob(job);
      } catch (e) {
        job.attempts = (job.attempts || 0) + 1;
        logger.error('payment execution failed', { jobId: job.id, attempts: job.attempts, e: e.message });
        if (job.attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, backoff(job.attempts)));
          await this.queue.enqueue(job);
        } else {
          this.monitor.notifyAll('payment:failed', { jobId: job.id, agentId: job.agentId, error: e.message });
        }
      }
    }
  }

  async executeJob(job) {
    // Emit start
    this.monitor.notifyAll('payment:processing', { jobId: job.id, agentId: job.agentId });

    const { txId } = await this.bc.executePayment({
      agentId: job.agentId,
      recipient: job.recipient,
      amount: job.amount,
      memo: job.memo,
    });

    this.monitor.notifyAll('payment:submitted', { jobId: job.id, txId });
  }
}

module.exports = {
  AgentOrchestrator,
  PaymentQueue,
  BlockchainConnector,
  AgentSession,
  TransactionMonitor,
  logger,
};
