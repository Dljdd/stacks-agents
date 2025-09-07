/*
  payment-service.js
  Processes agent payment requests with validation, fraud detection, multisig support,
  and real-time updates. Integrates with Stacks contracts and external APIs.

  Dependencies to install in backend/:
   - @stacks/transactions, @stacks/network
   - axios (for webhooks / external validation)
   - winston (logging)
*/

'use strict';

const axios = require('axios');
const winston = require('winston');
const {
  callReadOnlyFunction,
  cvToJSON,
  standardPrincipalCV,
  uintCV,
  stringAsciiCV,
  someCV,
  noneCV,
} = require('@stacks/transactions');
const { StacksMainnet, StacksTestnet } = require('@stacks/network');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp, ...meta }) => `${timestamp} [${level}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`)
  ),
  transports: [new winston.transports.Console()],
});

class PaymentService {
  /**
   * @param {Object} opts
   * @param {Object} opts.connector - instance of BlockchainConnector
   * @param {Object} opts.stacks - { network: 'testnet'|'mainnet', contracts: { rulesEngine, paymentProcessor } }
   * @param {Object} opts.monitor - TransactionMonitor-like, emits WS events
   * @param {Object} opts.webhooks - { url?: string, headers?: Record<string,string> }
   * @param {Object} opts.retry - { maxAttempts?: number, baseDelayMs?: number }
   */
  constructor({ connector, stacks, monitor, webhooks = {}, retry = {} }) {
    this.connector = connector;
    this.monitor = monitor;
    this.webhooks = webhooks;
    this.retry = { maxAttempts: 5, baseDelayMs: 500, ...retry };
    this.network = stacks?.network === 'mainnet' ? new StacksMainnet() : new StacksTestnet();
    this.contracts = stacks?.contracts || {};
  }

  // Orchestrates validation, fraud checks, broadcast, and tracking
  async processPayment(agentId, paymentData) {
    const { recipient, amount, memo, type = 'STX' } = paymentData;

    this.monitor?.notifyAll?.('payment:validate:start', { agentId, recipient, amount });
    await this.validatePaymentRules(agentId, amount, recipient, paymentData);

    this.monitor?.notifyAll?.('payment:fraud:start', { agentId });
    const fraudSignals = await this.detectFraud(paymentData, paymentData.historicalData || []);
    if (fraudSignals.block) {
      this.monitor?.notifyAll?.('payment:blocked:fraud', { agentId, reason: fraudSignals.reason });
      throw new Error(`fraud_blocked: ${fraudSignals.reason || 'unknown'}`);
    }

    // Broadcast via contract for STX payments using payment-processor
    let txId;
    if (type === 'STX') {
      const res = await this.connector.executePayment({ agentId, recipient, amount, memo });
      txId = res.txId;
    } else if (type === 'sBTC' || type === 'SIP-010') {
      // Placeholder: route through token contracts or token-aware payment processor
      // You can extend connector with token-specific calls
      throw new Error('token_type_not_implemented');
    } else {
      throw new Error('unsupported_payment_type');
    }

    this.monitor?.notifyAll?.('payment:broadcasted', { agentId, txId });

    // Track until confirmed or failed
    const status = await this.trackPaymentStatus(txId);
    await this.handlePaymentCallback({ txId, status, agentId, paymentData });

    return { txId, status };
  }

  // Validate via payment-processor.read-only and rules-engine evaluation
  async validatePaymentRules(agentId, amount, recipient, paymentData = {}) {
    // 1) payment-processor validate-payment-rules
    const v1 = await this._roCall({
      contract: this.contracts.paymentProcessor,
      functionName: 'validate-payment-rules',
      args: [standardPrincipalCV(agentId), uintCV(amount)],
    });

    if (v1.type === 'error') {
      const code = v1.value?.value || 'unknown';
      throw new Error(`rules_validation_error:${code}`);
    }

    // 2) rules-engine evaluate-rules (optional, returns action)
    if (this.contracts.rulesEngine) {
      const pd = paymentData;
      const ro = await this._roCall({
        contract: this.contracts.rulesEngine,
        functionName: 'evaluate-rules',
        args: [
          standardPrincipalCV(agentId),
          // tuple (amount, merchant, category, hour, day, txs-last-hour, country)
          {
            type: 12, // tuple CV
            data: {
              amount: uintCV(amount),
              merchant: standardPrincipalCV(pd.merchant || recipient),
              category: stringAsciiCV(pd.category || 'general'),
              hour: uintCV(pd.hour ?? new Date().getUTCHours()),
              day: uintCV(pd.day ?? new Date().getUTCDay()),
              'txs-last-hour': uintCV(pd.txsLastHour ?? 0),
              country: stringAsciiCV((pd.country || 'US').slice(0, 2)),
            },
          },
        ],
      });
      const action = this._cvAscii(ro);
      if (action && action !== 'allow') {
        throw new Error(`rules_engine_block:${action}`);
      }
    }

    // 3) simple recipient allow check from local policy if provided
    if (paymentData.allowedRecipients && Array.isArray(paymentData.allowedRecipients)) {
      if (!paymentData.allowedRecipients.includes(recipient)) {
        throw new Error('recipient_not_allowed_local');
      }
    }

    return true;
  }

  // Naive fraud detection combining heuristics and external signals
  async detectFraud(paymentData, historicalData = []) {
    const signals = { score: 0, reasons: [] };

    // Heuristic: large amount vs average
    const amounts = historicalData.map((h) => h.amount).filter((x) => typeof x === 'number');
    const avg = amounts.length ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0;
    if (avg && paymentData.amount > 3 * avg) {
      signals.score += 30; signals.reasons.push('amount_spike');
    }

    // Heuristic: new recipient
    const knownRecipients = new Set(historicalData.map((h) => h.recipient));
    if (!knownRecipients.has(paymentData.recipient)) {
      signals.score += 15; signals.reasons.push('new_recipient');
    }

    // External risk API (optional)
    if (this.webhooks?.url) {
      try {
        const resp = await axios.post(this.webhooks.url + '/risk', {
          agentId: paymentData.agentId,
          recipient: paymentData.recipient,
          amount: paymentData.amount,
        }, { headers: this.webhooks.headers || {} });
        if (resp.data?.riskScore) {
          signals.score += resp.data.riskScore;
          signals.reasons.push('external_risk');
        }
      } catch (e) {
        logger.warn('external risk call failed', { e: e.message });
      }
    }

    const block = signals.score >= 70;
    return { block, reason: signals.reasons.join(',') || null, score: signals.score };
  }

  // Broadcast already-signed transaction (alternative path)
  async broadcastTransaction(signedTx) {
    // Delegate to connector if available
    if (this.connector?.broadcastRaw) {
      return this.connector.broadcastRaw(signedTx);
    }
    throw new Error('broadcast_not_implemented');
  }

  // Poll Stacks API for tx status (simple implementation)
  async trackPaymentStatus(txId, { maxWaitMs = 120000, intervalMs = 4000 } = {}) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      try {
        const url = `${this.network.coreApiUrl || 'https://api.testnet.hiro.so'}/extended/v1/tx/${txId}`;
        const { data } = await axios.get(url);
        const status = data?.tx_status || data?.event_type;
        if (status === 'success' || status === 'abort_by_response' || status === 'failed') {
          this.monitor?.notifyAll?.('payment:status', { txId, status });
          return status;
        }
      } catch (e) {
        logger.warn('track status failed', { e: e.message, txId });
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    this.monitor?.notifyAll?.('payment:status', { txId, status: 'timeout' });
    return 'timeout';
  }

  async handlePaymentCallback(txResult) {
    // Send webhook notification if configured
    if (this.webhooks?.url) {
      try {
        await axios.post(this.webhooks.url + '/callback', txResult, { headers: this.webhooks.headers || {} });
      } catch (e) {
        logger.warn('webhook callback failed', { e: e.message });
      }
    }
    return true;
  }

  // ---------- Internal helpers ----------

  async _roCall({ contract, functionName, args }) {
    if (!contract?.address || !contract?.name) throw new Error('missing_contract_ref');
    const res = await callReadOnlyFunction({
      contractAddress: contract.address,
      contractName: contract.name,
      functionName,
      functionArgs: args,
      senderAddress: contract.address, // any valid principal
      network: this.network,
    });
    return cvToJSON(res);
  }

  _cvAscii(cvJson) {
    if (!cvJson) return undefined;
    // cvToJSON for string-ascii returns { type: 'string-ascii', value: '...' }
    if (cvJson.type === 'string-ascii') return cvJson.value;
    return undefined;
  }
}

module.exports = { PaymentService, logger };
