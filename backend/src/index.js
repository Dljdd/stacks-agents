import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { StacksClient } from './stacks-client.js';

// Load env from .env; if not present, fall back to .env.example
dotenv.config();
if (!process.env.AGENT_MANAGER_CONTRACT || !process.env.PAYMENT_PROCESSOR_CONTRACT) {
  const examplePath = path.resolve(process.cwd(), '.env.example');
  dotenv.config({ path: examplePath });
}

// Support alternate env variable names from .env.example
process.env.AGENT_MANAGER_CONTRACT = process.env.AGENT_MANAGER_CONTRACT || process.env.CONTRACT_AGENT_MANAGER;
process.env.RULES_ENGINE_CONTRACT = process.env.RULES_ENGINE_CONTRACT || process.env.CONTRACT_RULES_ENGINE;
process.env.PAYMENT_PROCESSOR_CONTRACT = process.env.PAYMENT_PROCESSOR_CONTRACT || process.env.CONTRACT_PAYMENT_PROCESSOR;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/updates' });

// Debug environment variables (no private keys used on backend)
console.log('Environment check:');
console.log('STACKS_NETWORK:', process.env.STACKS_NETWORK || 'testnet');
console.log('STACKS_API_URL:', process.env.STACKS_API_URL || 'https://api.testnet.hiro.so');
console.log('AGENT_MANAGER_CONTRACT:', process.env.AGENT_MANAGER_CONTRACT);
console.log('RULES_ENGINE_CONTRACT:', process.env.RULES_ENGINE_CONTRACT);
console.log('PAYMENT_PROCESSOR_CONTRACT:', process.env.PAYMENT_PROCESSOR_CONTRACT);

// Initialize Stacks client (read-only)
const stacksClient = new StacksClient({
  network: process.env.STACKS_NETWORK || 'testnet',
  apiUrl: process.env.STACKS_API_URL || 'https://api.testnet.hiro.so',
  agentManagerContract: process.env.AGENT_MANAGER_CONTRACT,
  rulesEngineContract: process.env.RULES_ENGINE_CONTRACT,
  paymentProcessorContract: process.env.PAYMENT_PROCESSOR_CONTRACT,
  readOnlySender: process.env.READONLY_SENDER || 'ST000000000000000000002AMW42H'
});

// In-memory cache for faster queries (optional)
const AGENT_CACHE = new Map();
const PAYMENT_CACHE = new Map();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Rate limit for /api
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 600 });
app.use('/api', apiLimiter);

// Health
app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

// Simple bearer auth check (dev-only): require Authorization header format
function requireAuth(req, res, next) {
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'unauthorized', message: 'Missing or invalid token' } });
  }
  // In a real system verify JWT; here we just accept any non-empty token
  return next();
}

function emit(event, payload) {
  const msg = JSON.stringify({ event, payload });
  wss.clients.forEach((client) => {
    try { client.send(msg); } catch {}
  });
}

// Contracts info
app.get('/api/contracts/info', (_req, res) => {
  return res.json({
    agentManager: process.env.AGENT_MANAGER_CONTRACT,
    rulesEngine: process.env.RULES_ENGINE_CONTRACT,
    paymentProcessor: process.env.PAYMENT_PROCESSOR_CONTRACT,
    network: process.env.STACKS_NETWORK || 'testnet',
    apiUrl: process.env.STACKS_API_URL || 'https://api.testnet.hiro.so'
  });
});

// Agents
app.post('/api/agents/create', requireAuth, async (req, res) => {
  try {
    const { name, owner, limits = {}, permissions = ['stx:transfer'], metadata = {} } = req.body || {};
    if (!name || !owner) {
      return res.status(400).json({ error: { code: 'validation_error', message: 'name and owner are required' } });
    }

    // Generate agent ID (use owner address as agent principal for simplicity)
    const agentId = owner;
    
    // No on-chain registration from backend; return payloads for wallet signing (frontend)
    const payloads = {
      registerAgent: {
        contractId: process.env.AGENT_MANAGER_CONTRACT,
        functionName: 'register-agent',
        args: [owner],
      },
      authorizeAgent: {
        contractId: process.env.AGENT_MANAGER_CONTRACT,
        functionName: 'authorize-agent',
        args: [owner],
      },
      // Rules engine setup examples
      createSpendingRule: limits && (limits.daily || limits.monthly) ? {
        contractId: process.env.RULES_ENGINE_CONTRACT,
        functionName: 'create-spending-rule',
        args: [owner, limits.daily || 0, limits.monthly || 0],
      } : null
    };
    
    // Cache agent info
    const agent = {
      id: agentId,
      name,
      owner,
      limits: { daily: limits.daily || 0, monthly: limits.monthly || 0 },
      permissions: Array.isArray(permissions) ? permissions : ['stx:transfer'],
      metadata,
      createdAt: new Date().toISOString(),
      payloads,
      status: 'pending-setup'
    };
    AGENT_CACHE.set(agentId, agent);
    
    emit('agent:created', { id: agentId, name, owner, payloads });
    return res.status(201).json(agent);
  } catch (error) {
    console.error('Error creating agent:', error);
    return res.status(500).json({ error: { code: 'blockchain_error', message: error.message } });
  }
});

app.get('/api/agents/list', requireAuth, async (req, res) => {
  try {
    const { owner } = req.query;
    let items = Array.from(AGENT_CACHE.values());
    
    // Refresh from blockchain for each cached agent
    for (const agent of items) {
      try {
        const onChainInfo = await stacksClient.getAgentInfo(agent.id);
        if (onChainInfo) {
          agent.limits = { daily: onChainInfo.dailyLimit, monthly: onChainInfo.monthlyLimit };
          agent.permissions = onChainInfo.permissions;
          agent.authorized = onChainInfo.authorized;
          AGENT_CACHE.set(agent.id, agent);
        }
      } catch (error) {
        console.warn(`Failed to refresh agent ${agent.id}:`, error.message);
      }
    }
    
    if (owner) {
      items = items.filter((a) => a.owner === owner);
    }
    
    return res.json({ items, nextCursor: null });
  } catch (error) {
    console.error('Error listing agents:', error);
    return res.status(500).json({ error: { code: 'blockchain_error', message: error.message } });
  }
});

app.put('/api/agents/:id/permissions', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions, limits } = req.body || {};

    const agent = AGENT_CACHE.get(id);
    if (!agent) {
      return res.status(404).json({ error: { code: 'not_found', message: 'agent not found' } });
    }

    // Backend no longer signs transactions. Return payloads for wallet signing.
    const payloads = {
      updatePermissions: permissions ? {
        contractId: process.env.AGENT_MANAGER_CONTRACT,
        functionName: 'update-permissions',
        args: [id, permissions]
      } : null,
      setSpendingLimit: limits ? {
        contractId: process.env.AGENT_MANAGER_CONTRACT,
        functionName: 'set-spending-limit',
        args: [id, limits.daily || 0, limits.monthly || 0]
      } : null
    };

    // Update cache optimistically
    if (permissions) agent.permissions = Array.isArray(permissions) ? permissions : agent.permissions;
    if (limits) agent.limits = { ...agent.limits, ...limits };
    AGENT_CACHE.set(id, agent);

    emit('agent:auth-changed', { agentId: id, payloads });
    return res.json({ ...agent, payloads });
  } catch (error) {
    console.error('Error updating agent permissions:', error);
    return res.status(500).json({ error: { code: 'blockchain_error', message: error.message } });
  }
});

// Payments: build wallet signing payload only
app.post('/api/payments/process', requireAuth, async (req, res) => {
  try {
    const { agentId, amount, recipient, memo, metadata = {} } = req.body || {};
    if (!agentId || typeof amount !== 'number' || !recipient) {
      return res.status(400).json({ error: { code: 'validation_error', message: 'agentId, amount, recipient required' } });
    }

    const agent = AGENT_CACHE.get(agentId);
    if (!agent) {
      return res.status(404).json({ error: { code: 'not_found', message: 'agent not found' } });
    }

    // For demo: simulate payment validation
    console.log(`Would validate payment rules for agent ${agentId}, amount ${amount}`);
    const isValid = amount <= (agent.limits.daily || 2000000); // Simple validation
    if (!isValid) {
      return res.status(400).json({ 
        error: { code: 'validation_failed', message: 'Payment exceeds daily limit' },
        decision: { authorize: false, risk: 0.9, reason: 'daily_limit_exceeded' }
      });
    }

    const paymentId = `pay_${uuidv4()}`;
    
    // Build payload for frontend wallet signing
    const payload = {
      contractId: process.env.PAYMENT_PROCESSOR_CONTRACT,
      functionName: 'execute-payment',
      args: [agentId, recipient, amount, memo || null],
    };
    
    const payment = {
      id: paymentId,
      agentId,
      amount,
      recipient,
      memo: memo || null,
      status: 'pending-signature',
      metadata,
      createdAt: new Date().toISOString()
    };

    PAYMENT_CACHE.set(paymentId, payment);
    emit('payment:submitted', { paymentId, agentId, amount, recipient });
    
    return res.status(202).json({ 
      paymentId, 
      status: 'pending-signature', 
      signingPayload: payload,
      decision: { authorize: true, risk: 0.1, reason: 'ok' }
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    return res.status(500).json({ error: { code: 'blockchain_error', message: error.message } });
  }
});

app.get('/api/payments/history', requireAuth, async (req, res) => {
  try {
    const { agentId, status } = req.query;
    let items = [];

    if (agentId) {
      // Get on-chain history for specific agent
      const history = await stacksClient.getPaymentHistory(agentId, 20);
      if (history.length && typeof history[0] === 'number') {
        // Flat list of IDs: fetch details for each
        items = [];
        for (const pid of history) {
          const d = await stacksClient.getPaymentDetails(pid);
          if (d) {
            items.push({
              id: `pay_${pid}`,
              agentId,
              amount: parseInt(d.amount.value),
              recipient: d.recipient.value,
              memo: d.memo.value ? d.memo.value.value : null,
              status: d.success.value ? 'success' : 'failed',
              txId: `block_${d['block-height'].value}`,
              createdAt: new Date().toISOString(),
              block: parseInt(d['block-height'].value)
            });
          }
        }
      } else {
        // Already detailed entries
        items = history.map((h, index) => ({
          id: `pay_${agentId}_${h.block}_${index}`,
          agentId,
          amount: h.amount,
          recipient: h.recipient,
          memo: h.memo,
          status: h.success ? 'success' : 'failed',
          txId: `block_${h.block}`,
          createdAt: new Date(Date.now() - (1000 * 60 * 60 * 24)).toISOString(),
          block: h.block
        }));
      }
    } else {
      // Return cached payments for all agents
      items = Array.from(PAYMENT_CACHE.values());
    }

    if (status) {
      items = items.filter((p) => p.status === status);
    }
    
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json({ items, nextCursor: null });
  } catch (error) {
    console.error('Error getting payment history:', error);
    return res.status(500).json({ error: { code: 'blockchain_error', message: error.message } });
  }
});

// Analytics
app.get('/api/analytics/spending', requireAuth, (req, res) => {
  // Minimal mock analytics from payments
  const items = Array.from(PAYMENTS.values()).filter((p) => p.status === 'success');
  const byDate = new Map();
  for (const p of items) {
    const d = new Date(p.createdAt).toISOString().slice(0, 10);
    byDate.set(d, (byDate.get(d) || 0) + p.amount);
  }
  const trend = Array.from(byDate.entries()).map(([date, amount]) => ({ date, amount }));
  const byCategory = [{ name: 'general', amount: items.reduce((s, p) => s + p.amount, 0) }];
  const agentPerfMap = new Map();
  for (const p of items) {
    const a = agentPerfMap.get(p.agentId) || { success: 0, total: 0 };
    a.success += 1; a.total += p.amount;
    agentPerfMap.set(p.agentId, a);
  }
  const agentPerformance = Array.from(agentPerfMap.entries()).map(([agentId, v]) => ({ agentId, successRate: 1.0, total: v.total }));
  return res.json({ trend, byCategory, agentPerformance });
});

// WebSocket connection logs
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ event: 'welcome', payload: { ts: Date.now() } }));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Stacks AI Payment Agents API listening on http://localhost:${PORT}`);
  console.log(`📊 WebSocket server ready for real-time updates`);
});
