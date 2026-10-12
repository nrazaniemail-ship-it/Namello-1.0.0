import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { OAuth2Client } from 'google-auth-library';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;
const PORT = Number(env.PORT || 8787);
const GOOGLE_CLIENT_ID = String(env.GOOGLE_CLIENT_ID || '').trim();
const AUTH_MODE = String(env.NAMELLO_AUTH_MODE || (NODE_ENV === 'production' ? 'google' : 'local')).trim().toLowerCase();
const DEV_USER_SUB = String(env.NAMELLO_DEV_USER_SUB || 'local-demo-user').trim();
const SESSION_SECRET = String(env.NAMELLO_SESSION_SECRET || '').trim();
const SESSION_TTL = Math.max(900, Number(env.SESSION_TTL_SECONDS || 43200));
const MAX_BODY = Math.max(1024 * 64, Number(env.MAX_BODY_BYTES || 2097152));
const CORS_ORIGINS = String(env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const NODE_ENV = String(env.NODE_ENV || 'development');
const DB_PATH = path.resolve(__dirname, env.DB_PATH || './data/namello.sqlite');

if (AUTH_MODE === 'google' && !GOOGLE_CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID is required when NAMELLO_AUTH_MODE=google');
if (AUTH_MODE !== 'google' && NODE_ENV === 'production') throw new Error('Production requires NAMELLO_AUTH_MODE=google');
if (SESSION_SECRET.length < 32) throw new Error('NAMELLO_SESSION_SECRET must be at least 32 characters');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  picture TEXT NOT NULL DEFAULT '',
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_revisions (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  device_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  app_version TEXT NOT NULL DEFAULT '',
  pack_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, revision)
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_user_rev ON sync_revisions(user_id, revision DESC);
`);

const googleClient = new OAuth2Client();
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  if (NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || CORS_ORIGINS.includes('*') || CORS_ORIGINS.includes(origin)) {
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, If-Match');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});
app.use(express.json({ limit: MAX_BODY, strict: true }));

const rate = new Map();
function rateLimit(key, max = 30, windowMs = 60_000) {
  const now = Date.now();
  const item = rate.get(key);
  if (!item || item.reset <= now) { rate.set(key, { count: 1, reset: now + windowMs }); return true; }
  item.count += 1;
  return item.count <= max;
}
app.use('/v1', (req, res, next) => {
  const ip = String(req.ip || 'unknown');
  if (!rateLimit(ip, 120, 60_000)) return res.status(429).json({ error: 'rate_limited' });
  next();
});

function nowIso() { return new Date().toISOString(); }
function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function signSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.jti || !payload.uid || Number(payload.exp) * 1000 <= Date.now()) return null;
    return payload;
  } catch { return null; }
}
function issueSession(userId) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { uid: userId, jti: crypto.randomUUID(), iat: now, exp: now + SESSION_TTL };
  const token = signSession(payload);
  const tokenHash = sha256(token);
  const created = nowIso();
  const expires = new Date((now + SESSION_TTL) * 1000).toISOString();
  db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at,last_seen_at) VALUES(?,?,?,?,?)').run(tokenHash, userId, created, expires, created);
  return { token, expiresAt: expires };
}
function auth(req, res, next) {
  const raw = String(req.headers.authorization || '');
  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : '';
  const p = verifySessionToken(token);
  if (!p) return res.status(401).json({ error: 'unauthorized' });
  const row = db.prepare('SELECT s.token_hash, s.user_id, s.expires_at, u.google_sub, u.email, u.name, u.picture, u.email_verified FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(sha256(token), nowIso());
  if (!row) return res.status(401).json({ error: 'session_expired' });
  db.prepare('UPDATE sessions SET last_seen_at=? WHERE token_hash=?').run(nowIso(), row.token_hash);
  req.auth = { userId: row.user_id, tokenHash: row.token_hash, user: { sub: row.google_sub, email: row.email, name: row.name, picture: row.picture, verified: !!row.email_verified } };
  next();
}
function publicUser(row) { return { sub: row.google_sub, email: row.email, name: row.name, picture: row.picture, verified: !!row.email_verified }; }
function validatePack(pack) {
  if (!pack || typeof pack !== 'object') throw new Error('invalid_pack');
  if (pack.kind !== 'namello-sync') throw new Error('invalid_kind');
  if (pack.alg !== 'AES-GCM' || pack.kdf !== 'PBKDF2-SHA256') throw new Error('unsupported_encryption');
  if (!pack.salt || !pack.iv || !pack.data || typeof pack.data !== 'string') throw new Error('invalid_ciphertext');
  if (pack.meta?.schema !== 3) throw new Error('unsupported_schema');
  if (!Number.isSafeInteger(Number(pack.meta?.revision)) || Number(pack.meta.revision) < 1) throw new Error('invalid_pack_revision');
  if (!pack.meta?.deviceId || !pack.meta?.updatedAt || !pack.meta?.appVersion) throw new Error('invalid_meta');
  if (pack.data.length > MAX_BODY) throw new Error('pack_too_large');
}
function latest(userId) { return db.prepare('SELECT revision,device_id,updated_at,app_version,pack_json,created_at FROM sync_revisions WHERE user_id=? ORDER BY revision DESC LIMIT 1').get(userId); }

app.get('/healthz', (_req, res) => res.json({ ok: true, service: 'namello-sync', version: '1.0.26', authMode: AUTH_MODE, time: nowIso() }));
app.post('/v1/auth/dev', (req, res) => {
  if (AUTH_MODE !== 'local' || NODE_ENV === 'production') return res.status(404).json({ error: 'not_available' });
  const ts = nowIso();
  let existing = db.prepare('SELECT * FROM users WHERE google_sub=?').get(DEV_USER_SUB);
  if (!existing) {
    db.prepare('INSERT INTO users(google_sub,email,name,picture,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(DEV_USER_SUB, 'local@example.invalid', 'Namello Local User', '', 0, ts, ts);
  } else {
    db.prepare('UPDATE users SET updated_at=? WHERE id=?').run(ts, existing.id);
  }
  const user = db.prepare('SELECT * FROM users WHERE google_sub=?').get(DEV_USER_SUB);
  const session = issueSession(user.id);
  res.json({ token: session.token, expiresAt: session.expiresAt, user: publicUser(user), mode: 'local' });
});
app.post('/v1/auth/google/verify', async (req, res) => {
  if (AUTH_MODE !== 'google') return res.status(404).json({ error: 'google_auth_disabled' });
  if (!rateLimit(`auth:${req.ip}`, 12, 60_000)) return res.status(429).json({ error: 'rate_limited' });
  const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken : '';
  if (!idToken) return res.status(400).json({ error: 'id_token_required' });
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
    const p = ticket.getPayload();
    if (!p?.sub || !p?.iss || !['accounts.google.com', 'https://accounts.google.com'].includes(p.iss)) throw new Error('invalid_issuer');
    const ts = nowIso();
    const existing = db.prepare('SELECT * FROM users WHERE google_sub=?').get(p.sub);
    if (existing) {
      db.prepare('UPDATE users SET email=?,name=?,picture=?,email_verified=?,updated_at=? WHERE id=?').run(p.email || '', p.name || '', p.picture || '', p.email_verified ? 1 : 0, ts, existing.id);
    } else {
      db.prepare('INSERT INTO users(google_sub,email,name,picture,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(p.sub, p.email || '', p.name || '', p.picture || '', p.email_verified ? 1 : 0, ts, ts);
    }
    const user = db.prepare('SELECT * FROM users WHERE google_sub=?').get(p.sub);
    const session = issueSession(user.id);
    return res.json({ token: session.token, expiresAt: session.expiresAt, user: publicUser(user) });
  } catch (e) {
    return res.status(401).json({ error: 'invalid_google_token', detail: e?.message || 'verification_failed' });
  }
});
app.post('/v1/auth/logout', auth, (req, res) => { db.prepare('DELETE FROM sessions WHERE token_hash=?').run(req.auth.tokenHash); res.status(204).end(); });
const LLM_API_URL = String(env.NAMELLO_LLM_API_URL || '').trim();
const LLM_API_KEY = String(env.NAMELLO_LLM_API_KEY || '').trim();
const LLM_MODEL = String(env.NAMELLO_LLM_MODEL || '').trim();
app.post('/v1/llm/strategic', auth, async (req, res) => {
  if (!LLM_API_URL || !LLM_API_KEY) return res.status(503).json({ error: 'llm_not_configured' });
  const data = req.body?.data;
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'strategic_data_required' });
  const system = typeof req.body?.system === 'string' ? req.body.system : '';
  const user = typeof req.body?.user === 'string' ? req.body.user : JSON.stringify(data);
  const model = typeof req.body?.model === 'string' && req.body.model.trim() ? req.body.model.trim() : LLM_MODEL;
  if (!model) return res.status(503).json({ error: 'llm_model_not_configured' });
  try {
    const upstream = await fetch(LLM_API_URL, { method:'POST', headers:{'Content-Type':'application/json','Authorization': 'Bearer '+LLM_API_KEY}, body:JSON.stringify({model,messages:[{role:'system',content:system},{role:'user',content:user}],temperature:Number(req.body?.temperature)||0.2,response_format:{type:'json_object'}}) });
    const text = await upstream.text();
    let parsed=null; try{parsed=JSON.parse(text);}catch(e){}
    if(!upstream.ok) return res.status(502).json({error:'llm_upstream_error',status:upstream.status,detail:parsed?.error?.message||text.slice(0,500)});
    if(!parsed) return res.status(502).json({error:'llm_invalid_response'});
    return res.json({...parsed,model});
  } catch(e) { return res.status(502).json({error:'llm_unreachable',detail:e?.message||'upstream_failed'}); }
});
app.get('/v1/me', auth, (req, res) => res.json({ user: req.auth.user }));
app.get('/v1/sync/latest', auth, (req, res) => {
  const row = latest(req.auth.userId);
  if (!row) return res.status(404).json({ error: 'no_sync' });
  res.json({ revision: row.revision, deviceId: row.device_id, updatedAt: row.updated_at, appVersion: row.app_version, pack: JSON.parse(row.pack_json) });
});
app.get('/v1/sync/revisions/:revision', auth, (req, res) => {
  const revision = Number(req.params.revision);
  if (!Number.isSafeInteger(revision) || revision < 1) return res.status(400).json({ error: 'invalid_revision' });
  const row = db.prepare('SELECT revision,device_id,updated_at,app_version,pack_json FROM sync_revisions WHERE user_id=? AND revision=?').get(req.auth.userId, revision);
  if (!row) return res.status(404).json({ error: 'revision_not_found' });
  res.json({ revision: row.revision, deviceId: row.device_id, updatedAt: row.updated_at, appVersion: row.app_version, pack: JSON.parse(row.pack_json) });
});
app.put('/v1/sync/revisions/:revision', auth, (req, res) => {
  const expected = Number(req.headers['if-match'] || req.body?.expectedRevision || 0);
  const requestedRevision = Number(req.params.revision);
  const pack = req.body?.pack;
  try { validatePack(pack); } catch (e) { return res.status(400).json({ error: e.message }); }
  if (!Number.isSafeInteger(requestedRevision) || requestedRevision < 1) return res.status(400).json({ error: 'invalid_revision' });
  if (Number(pack.meta.revision) !== requestedRevision) return res.status(400).json({ error: 'pack_revision_mismatch' });
  const current = latest(req.auth.userId);
  const currentRevision = current ? Number(current.revision) : 0;
  if (expected !== currentRevision) return res.status(409).json({ error: 'sync_conflict', currentRevision, latest: current ? { revision: current.revision, deviceId: current.device_id, updatedAt: current.updated_at, appVersion: current.app_version } : null });
  if (requestedRevision !== currentRevision + 1) return res.status(409).json({ error: 'revision_must_increment', currentRevision, expectedRevision: currentRevision + 1 });
  const ts = nowIso();
  try {
    db.exec('BEGIN IMMEDIATE');
    const locked = latest(req.auth.userId);
    const lockedRevision = locked ? Number(locked.revision) : 0;
    if (lockedRevision !== expected || requestedRevision !== lockedRevision + 1) {
      db.exec('ROLLBACK');
      return res.status(409).json({ error: 'sync_conflict', currentRevision: lockedRevision, latest: locked ? { revision: locked.revision, deviceId: locked.device_id, updatedAt: locked.updated_at, appVersion: locked.app_version } : null });
    }
    const tx = db.prepare('INSERT INTO sync_revisions(user_id,revision,device_id,updated_at,app_version,pack_json,created_at) VALUES(?,?,?,?,?,?,?)');
    tx.run(req.auth.userId, requestedRevision, pack.meta.deviceId, pack.meta.updatedAt, pack.meta.appVersion, JSON.stringify(pack), ts);
    db.exec('COMMIT');
    return res.status(201).json({ revision: requestedRevision, updatedAt: pack.meta.updatedAt, deviceId: pack.meta.deviceId, appVersion: pack.meta.appVersion });
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch {}
    if (String(e?.message || '').toLowerCase().includes('unique') || String(e?.message || '').toLowerCase().includes('constraint')) return res.status(409).json({ error: 'sync_conflict' });
    return res.status(500).json({ error: 'sync_write_failed' });
  }
});
app.delete('/v1/account', auth, (req, res) => {
  const userId = req.auth.userId;
  db.prepare('DELETE FROM users WHERE id=?').run(userId);
  res.status(204).end();
});

app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'payload_too_large' });
  res.status(500).json({ error: 'server_error' });
});

const cleanup = setInterval(() => { try { db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowIso()); } catch {} }, 15 * 60_000);
cleanup.unref();
app.listen(PORT, () => console.log(`Namello sync backend listening on :${PORT}`));
