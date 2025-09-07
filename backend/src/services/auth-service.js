'use strict';

/*
  auth-service.js
  Secure authentication for users and agents with RBAC, sessions, API keys, MFA hooks,
  JWT management with secret rotation, and abuse protections.

  Dependencies (install in backend/):
   - @stacks/auth
   - jsonwebtoken
   - bcrypt
   - uuid
   - winston
   - redis (optional; used if REDIS_URL provided)
*/

const winston = require('winston');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { createClient } = require('redis');
const { v4: uuidv4 } = require('uuid');
const stacksAuth = require('@stacks/auth');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp, ...meta }) => `${timestamp} [${level}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`)
  ),
  transports: [new winston.transports.Console()],
});

// ---------------- TokenManager ----------------
class TokenManager {
  constructor({ issuer = 'stacks-agents', audience = 'api', secrets = [] } = {}) {
    // secrets: [{ kid, secret, alg }], newest last
    this.issuer = issuer;
    this.audience = audience;
    this.secrets = secrets.length ? secrets : [{ kid: 'primary', secret: process.env.JWT_SECRET || uuidv4(), alg: 'HS256' }];
  }

  currentKey() { return this.secrets[this.secrets.length - 1]; }

  issueToken(payload, { expiresIn = '1h', subject } = {}) {
    const key = this.currentKey();
    const header = { kid: key.kid, alg: key.alg };
    const body = { ...payload, iss: this.issuer, aud: this.audience, sub: subject };
    return jwt.sign(body, key.secret, { algorithm: key.alg, expiresIn, header });
  }

  verifyToken(token) {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.header?.kid) throw new Error('invalid_token');
    const key = this.secrets.find(k => k.kid === decoded.header.kid);
    if (!key) throw new Error('unknown_kid');
    return jwt.verify(token, key.secret, { algorithms: [key.alg], audience: this.audience, issuer: this.issuer });
  }

  rotateSecret(newSecret, { kid = uuidv4(), alg = 'HS256' } = {}) {
    this.secrets.push({ kid, secret: newSecret, alg });
    if (this.secrets.length > 5) this.secrets = this.secrets.slice(-5); // retain last 5
    logger.info('jwt secret rotated', { kid });
  }
}

// ---------------- SessionManager ----------------
class SessionManager {
  constructor({ redisUrl } = {}) {
    this.redisUrl = redisUrl;
    this.mem = new Map();
    if (redisUrl) {
      this.redis = createClient({ url: redisUrl });
      this.redis.on('error', (e) => logger.error('redis session error', { e: e.message }));
      this.redis.connect().catch(e => logger.error('redis connect failed', { e: e.message }));
    }
  }

  async createSession({ userId, agentId, ttlSec = 3600, data = {} }) {
    const id = uuidv4();
    const now = Date.now();
    const session = { id, userId, agentId, data, issuedAt: now, expiresAt: now + ttlSec * 1000 };
    if (this.redis) {
      await this.redis.setEx(`sess:${id}`, ttlSec, JSON.stringify(session));
    } else {
      this.mem.set(id, session);
      setTimeout(() => this.mem.delete(id), ttlSec * 1000).unref?.();
    }
    return session;
  }

  async getSession(id) {
    if (this.redis) {
      const s = await this.redis.get(`sess:${id}`);
      return s ? JSON.parse(s) : null;
    }
    return this.mem.get(id) || null;
  }

  async revokeSession(id) {
    if (this.redis) return this.redis.del(`sess:${id}`);
    this.mem.delete(id);
  }
}

// ---------------- RoleManager ----------------
class RoleManager {
  constructor({ roles = {} } = {}) {
    // roles: { roleName: Set(permissions) }
    this.roles = new Map(Object.entries(roles).map(([k, v]) => [k, new Set(v)]));
    // Basic defaults
    if (!this.roles.size) {
      this.roles.set('user', new Set(['payments:read']));
      this.roles.set('agent', new Set(['payments:execute']));
      this.roles.set('admin', new Set(['*']));
    }
  }

  hasPermission(role, permission) {
    const perms = this.roles.get(role) || new Set();
    if (perms.has('*')) return true;
    return perms.has(permission);
  }

  requirePermission(userOrAgent, permission) {
    const roles = Array.isArray(userOrAgent.roles) ? userOrAgent.roles : [userOrAgent.role || 'user'];
    const ok = roles.some(r => this.hasPermission(r, permission));
    if (!ok) throw new Error('forbidden');
    return true;
  }
}

// ---------------- SecurityMonitor ----------------
class SecurityMonitor {
  constructor({ maxAttempts = 5, windowMs = 15 * 60 * 1000, lockoutMs = 30 * 60 * 1000 } = {}) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.lockoutMs = lockoutMs;
    this.attempts = new Map(); // key -> { count, firstAt, lockedUntil }
  }

  _get(key) {
    const now = Date.now();
    let s = this.attempts.get(key) || { count: 0, firstAt: now, lockedUntil: 0 };
    if (now - s.firstAt > this.windowMs) s = { count: 0, firstAt: now, lockedUntil: 0 };
    this.attempts.set(key, s);
    return s;
  }

  check(key) {
    const now = Date.now();
    const s = this._get(key);
    if (s.lockedUntil && now < s.lockedUntil) throw new Error('account_locked');
    return true;
  }

  reportSuccess(key) {
    this.attempts.delete(key);
  }

  reportFailure(key) {
    const s = this._get(key);
    s.count += 1;
    if (s.count >= this.maxAttempts) {
      s.lockedUntil = Date.now() + this.lockoutMs;
    }
    this.attempts.set(key, s);
    return s;
  }
}

// ---------------- AuthService ----------------
class AuthService {
  constructor({ tokenManager, sessionManager, roleManager, securityMonitor }) {
    this.tokens = tokenManager || new TokenManager();
    this.sessions = sessionManager || new SessionManager({ redisUrl: process.env.REDIS_URL });
    this.roles = roleManager || new RoleManager();
    this.security = securityMonitor || new SecurityMonitor();

    // API key store (hashed). In production back with DB/Redis.
    this.apiKeys = new Map(); // keyId -> { hash, ownerId, roles, createdAt, revoked }
  }

  // --- Stacks wallet authentication (Stacks Connect authResponse) ---
  async authenticateStacksWallet({ authResponse, loginHint }) {
    try {
      this.security.check(loginHint || 'stacks:' + (authResponse?.slice(0, 16) || 'unknown'));
      // Basic decode. Further validation can include appDomain, redirectUri, and signature checks.
      const decoded = stacksAuth.decodeAuthResponse(authResponse);
      const address = decoded?.payload?.payload?.address || decoded?.payload?.username || 'unknown';
      if (!address) throw new Error('invalid_auth_response');

      const session = await this.sessions.createSession({ userId: address, ttlSec: 3600, data: { method: 'stacks' } });
      const jwt = this.tokens.issueToken({ userId: address, roles: ['user'] }, { subject: address, expiresIn: '1h' });
      this.security.reportSuccess(loginHint || 'stacks:' + address);
      logger.info('user authenticated via stacks', { address });
      return { session, token: jwt };
    } catch (e) {
      this.security.reportFailure(loginHint || 'stacks:unknown');
      logger.error('stacks auth failed', { e: e.message });
      throw e;
    }
  }

  // --- API key management for agents ---
  async generateApiKey({ agentId, roles = ['agent'] }) {
    const keyId = uuidv4();
    const secret = uuidv4().replace(/-/g, '');
    const apiKey = `${keyId}.${secret}`;
    const hash = await bcrypt.hash(apiKey, 10);
    this.apiKeys.set(keyId, { hash, ownerId: agentId, roles, createdAt: Date.now(), revoked: false });
    logger.info('api key generated', { keyId, agentId });
    return { keyId, apiKey };
  }

  revokeApiKey(keyId) {
    const rec = this.apiKeys.get(keyId);
    if (rec) { rec.revoked = true; this.apiKeys.set(keyId, rec); }
    logger.info('api key revoked', { keyId });
    return true;
  }

  async validateApiKey(apiKey) {
    if (!apiKey) throw new Error('missing_api_key');
    const [keyId, secret] = apiKey.split('.');
    const rec = this.apiKeys.get(keyId);
    if (!rec || rec.revoked) throw new Error('invalid_api_key');
    const ok = await bcrypt.compare(apiKey, rec.hash);
    if (!ok) throw new Error('invalid_api_key');
    return { keyId, ownerId: rec.ownerId, roles: rec.roles };
  }

  // --- JWT validation & issuance ---
  issueJwtForUser(user) {
    return this.tokens.issueToken({ userId: user.id, roles: user.roles || ['user'] }, { subject: user.id, expiresIn: '1h' });
  }

  verifyJwt(token) {
    return this.tokens.verifyToken(token);
  }

  // --- Session management ---
  async createSession(payload) { return this.sessions.createSession(payload); }
  async getSession(id) { return this.sessions.getSession(id); }
  async revokeSession(id) { return this.sessions.revokeSession(id); }

  // --- RBAC ---
  requirePermission(subject, permission) { return this.roles.requirePermission(subject, permission); }

  // --- MFA hooks (stubbed: integrate TOTP/SMS/email providers) ---
  async initiateMFA(userId, method = 'totp') {
    // In production, generate TOTP secret or send OTP via provider
    logger.info('mfa initiated', { userId, method });
    return { challengeId: uuidv4(), method };
  }

  async verifyMFA(challengeId, code) {
    // Verify against stored challenge; stub always passes
    return true;
  }

  // --- Middleware helpers ---
  middleware() {
    return {
      requireJWT: (permission) => async (req, res, next) => {
        try {
          const hdr = req.headers['authorization'] || '';
          const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
          if (!token) return res.status(401).json({ error: 'missing_token' });
          const claims = this.verifyJwt(token);
          if (permission) this.requirePermission({ roles: claims.roles }, permission);
          req.user = claims;
          return next();
        } catch (e) {
          return res.status(401).json({ error: 'invalid_token' });
        }
      },

      requireApiKey: (permission) => async (req, res, next) => {
        try {
          const apiKey = req.headers['x-api-key'];
          const info = await this.validateApiKey(apiKey);
          if (permission) this.requirePermission({ roles: info.roles }, permission);
          req.agent = info;
          return next();
        } catch (e) {
          return res.status(401).json({ error: e.message || 'invalid_api_key' });
        }
      },

      rateLimit: (keyFn = (req) => req.ip, { limit = 100, windowMs = 60_000 } = {}) => {
        const bucket = new Map(); // key -> { count, firstAt }
        return (req, res, next) => {
          const key = keyFn(req);
          const now = Date.now();
          const s = bucket.get(key) || { count: 0, firstAt: now };
          if (now - s.firstAt > windowMs) { s.count = 0; s.firstAt = now; }
          s.count += 1;
          bucket.set(key, s);
          if (s.count > limit) return res.status(429).json({ error: 'rate_limited' });
          return next();
        };
      },
    };
  }
}

module.exports = {
  AuthService,
  TokenManager,
  SessionManager,
  RoleManager,
  SecurityMonitor,
  logger,
};
