import { readJsonBody, BodyError } from './bodyLimit.js';
import { authenticatedUser, response } from './reads.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLIENTS = new Set(['ifund-device-v1', 'ifund-cli-v1', 'ifund-agent-v1']);
const SCOPES = new Set(['identity:read', 'campaigns:read']);
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const JSON_TYPE = /^application\\/json(?:\\s*;|\\s*$)/i;
const SELECT = 'id,device_code_hash,user_code_hash,access_token_hash,client_id,device_label,scopes,state,owner_id,created_at,expires_at,approved_at,grant_expires_at';

function configReady(env) {
  return typeof env?.SUPABASE_URL === 'string' &&
    /^https:\\/\\/[a-z0-9.-]+\\.supabase\\.co$/i.test(env.SUPABASE_URL) &&
    typeof env?.SUPABASE_SERVICE_ROLE_KEY === 'string' && env.SUPABASE_SERVICE_ROLE_KEY.length > 20 &&
    typeof env?.DEVICE_TOKEN_SECRET === 'string' && env.DEVICE_TOKEN_SECRET.length >= 32;
}
async function sha256(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function randomToken(bytes = 32) {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return [...raw].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function userCode() {
  const raw = crypto.getRandomValues(new Uint8Array(8));
  return [...raw].map((x) => CODE_ALPHABET[x % CODE_ALPHABET.length]).join('');
}
async function deriveAccessToken(deviceCode, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('ifund-device-access-v1:' + deviceCode));
  return [...new Uint8Array(signed)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function dbHeaders(env, prefer = '') {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(prefer ? { Prefer: prefer } : {}),
  };
}
async function db(env, path, init = {}, fetcher = fetch) {
  const res = await fetcher(env.SUPABASE_URL + '/rest/v1/' + path, {
    ...init, headers: { ...dbHeaders(env, init.prefer || ''), ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error('device store unavailable');
  if (res.status === 204) return [];
  const type = res.headers.get('content-type') || '';
  return type.includes('json') ? await res.json() : [];
}
async function rateAllowed(env, bucket, limit, seconds, fetcher) {
  const bucketHash = await sha256(String(env.DEVICE_TOKEN_SECRET) + ':' + bucket);
  const rows = await db(env, 'rpc/ifund_device_rate_limit', {
    method: 'POST', body: JSON.stringify({ p_bucket_hash: bucketHash, p_limit: limit, p_window_seconds: seconds }),
  }, fetcher);
  return rows === true;
}
function clientBucket(request) {
  // The edge-provided IP is used only as input to a keyed hash; raw IP is never stored.
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  return 'ip:' + ip;
}
async function member(request, env, fetcher) {
  return authenticatedUser(request, {
    ...env,
  }, fetcher);
}
async function getBy(env, column, value, fetcher) {
  const params = new URLSearchParams({ select: SELECT, [column]: 'eq.' + value, limit: '1' });
  const rows = await db(env, 'ifund_device_authorizations?' + params.toString(), {}, fetcher);
  return Array.isArray(rows) ? rows[0] || null : null;
}
function validScopes(scopes) {
  return Array.isArray(scopes) && scopes.length >= 1 && scopes.length <= 2 &&
    new Set(scopes).size === scopes.length && scopes.every((scope) => SCOPES.has(scope));
}

/** Server-only device-code authorization. Requires staged schema and server secrets. */
export async function routeDeviceAuthorization(request, env, fetcher = fetch) {
  const path = new URL(request.url).pathname;
  if (!path.startsWith('/api/device-authorization/')) return response(404, { error: 'Not found.' });
  if (!configReady(env)) return response(503, { error: 'Device authorization is not enabled.' });
  const mode = path.slice('/api/device-authorization/'.length);
  try {
    if (mode === 'request' && request.method === 'POST') {
      if (!await rateAllowed(env, clientBucket(request), 10, 60, fetcher))
        return response(429, { error: 'Too many requests. Try again later.' });
      const body = await readJsonBody(request, 2048);
      if (!body || typeof body !== 'object' || Array.isArray(body) ||
          !CLIENTS.has(body.client_id) || typeof body.device_label !== 'string' ||
          body.device_label.trim().length < 1 || body.device_label.trim().length > 80 ||
          !validScopes(body.scopes)) {
        return response(422, { error: 'Invalid device request.' });
      }
      const deviceCode = randomToken();
      const shortCode = userCode();
      const token = await deriveAccessToken(deviceCode, env.DEVICE_TOKEN_SECRET);
      const now = Date.now();
      const expiresAt = new Date(now + 10 * 60 * 1000).toISOString();
      const rows = await db(env, 'ifund_device_authorizations', {
        method: 'POST', prefer: 'return=representation',
        body: JSON.stringify({
          device_code_hash: await sha256(deviceCode),
          user_code_hash: await sha256(shortCode),
          access_token_hash: await sha256(token),
          client_id: body.client_id,
          device_label: body.device_label.trim(),
          scopes: body.scopes,
          state: 'pending',
          expires_at: expiresAt,
        }),
      }, fetcher);
      if (!Array.isArray(rows) || rows.length !== 1) return response(503, { error: 'Device request could not be created.' });
      return response(201, {
        device_code: deviceCode,
        user_code: shortCode,
        verification_uri: new URL('/activate', request.url).toString(),
        expires_in: 600,
        interval: 5,
      });
    }

    if (mode === 'inspect' && request.method === 'POST') {
      const account = await member(request, env, fetcher);
      if (!account) return response(401, { error: 'Sign in to approve a device.' });
      if (!await rateAllowed(env, 'inspect:' + account.uid, 20, 60, fetcher))
        return response(429, { error: 'Too many attempts. Try again later.' });
      const body = await readJsonBody(request, 1024);
      if (!body || typeof body.user_code !== 'string' || !/^[A-HJ-NP-Z2-9]{8}$/.test(body.user_code.toUpperCase()))
        return response(422, { error: 'Enter a valid activation code.' });
      const record = await getBy(env, 'user_code_hash', await sha256(body.user_code.toUpperCase()), fetcher);
      if (!record || record.state !== 'pending' || Date.parse(record.expires_at) <= Date.now())
        return response(404, { error: 'This activation code is invalid or expired.' });
      return response(200, { id: record.id, device_label: record.device_label, client_id: record.client_id,
        scopes: record.scopes, expires_at: record.expires_at });
    }

    if (mode === 'decide' && request.method === 'POST') {
      const account = await member(request, env, fetcher);
      if (!account) return response(401, { error: 'Sign in to approve a device.' });
      if (!await rateAllowed(env, 'decide:' + account.uid, 10, 60, fetcher))
        return response(429, { error: 'Too many approval attempts. Try again later.' });
      const body = await readJsonBody(request, 2048);
      if (!body || typeof body.user_code !== 'string' || !/^[A-HJ-NP-Z2-9]{8}$/i.test(body.user_code) ||
          !UUID.test(body.id || '') || !['approve', 'deny'].includes(body.decision) ||
          (body.decision === 'approve' && !validScopes(body.scopes))) {
        return response(422, { error: 'Invalid device decision.' });
      }
      const inspected = await getBy(env, 'user_code_hash', await sha256(body.user_code.toUpperCase()), fetcher);
      if (!inspected || inspected.id !== body.id || inspected.state !== 'pending' ||
          Date.parse(inspected.expires_at) <= Date.now())
        return response(409, { error: 'This activation code has expired or changed. Inspect it again.' });
      const scopes = body.decision === 'approve' ? body.scopes : [];
      if (body.decision === 'approve' &&
          (!validScopes(scopes) || scopes.some((scope) => !inspected.scopes.includes(scope))))
        return response(422, { error: 'Select only permissions requested by this device.' });
      const params = new URLSearchParams({ id: 'eq.' + body.id, state: 'eq.pending',
        user_code_hash: 'eq.' + await sha256(body.user_code.toUpperCase()),
        expires_at: 'gt.' + new Date().toISOString(), select: SELECT });
      const patch = body.decision === 'approve'
        ? { state: 'approved', owner_id: account.uid, approved_at: new Date().toISOString(),
            grant_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), scopes }
        : { state: 'denied' };
      const rows = await db(env, 'ifund_device_authorizations?' + params.toString(), {
        method: 'PATCH', prefer: 'return=representation', body: JSON.stringify(patch),
      }, fetcher);
      if (!Array.isArray(rows) || rows.length !== 1)
        return response(409, { error: 'This request has expired or has already been decided.' });
      return response(200, { state: patch.state });
    }

    if (mode === 'token' && request.method === 'POST') {
      if (!await rateAllowed(env, clientBucket(request), 30, 60, fetcher))
        return response(429, { error: 'Too many requests. Try again later.' });
      const body = await readJsonBody(request, 2048);
      if (!body || typeof body.device_code !== 'string' || !/^[a-f0-9]{64}$/.test(body.device_code))
        return response(422, { error: 'Invalid device request.' });
      const record = await getBy(env, 'device_code_hash', await sha256(body.device_code), fetcher);
      if (!record || Date.parse(record.expires_at) <= Date.now()) return response(400, { error: 'expired_token' });
      if (record.state === 'pending') {
        await db(env, 'ifund_device_authorizations?id=eq.' + record.id, {
          method: 'PATCH', body: JSON.stringify({ last_polled_at: new Date().toISOString() }),
        }, fetcher);
        return response(200, { status: 'authorization_pending', interval: 5 });
      }
      if (record.state === 'denied') return response(200, { status: 'access_denied' });
      if (record.state !== 'approved' || !record.owner_id ||
          !record.grant_expires_at || Date.parse(record.grant_expires_at) <= Date.now())
        return response(400, { error: 'expired_token' });
      const token = await deriveAccessToken(body.device_code, env.DEVICE_TOKEN_SECRET);
      if (await sha256(token) !== record.access_token_hash) return response(400, { error: 'invalid_grant' });
      return response(200, { access_token: token, token_type: 'Bearer',
        scope: record.scopes.join(' '), expires_at: record.grant_expires_at });
    }

    if (mode === 'revoke' && request.method === 'POST') {
      const account = await member(request, env, fetcher);
      if (!account) return response(401, { error: 'Sign in to manage connected devices.' });
      const body = await readJsonBody(request, 1024);
      if (!body || !UUID.test(body.id || '')) return response(422, { error: 'Invalid device.' });
      const rows = await db(env, 'ifund_device_authorizations?id=eq.' + body.id +
        '&owner_id=eq.' + account.uid + '&state=eq.approved&select=id', {
        method: 'PATCH', prefer: 'return=representation', body: JSON.stringify({ state: 'revoked' }),
      }, fetcher);
      if (!Array.isArray(rows) || rows.length !== 1) return response(404, { error: 'Connected device not found.' });
      return response(200, { revoked: true });
    }

    if (mode === 'devices' && request.method === 'GET') {
      const account = await member(request, env, fetcher);
      if (!account) return response(401, { error: 'Sign in to manage connected devices.' });
      const params = new URLSearchParams({ select: 'id,client_id,device_label,scopes,state,created_at,approved_at,grant_expires_at,last_polled_at',
        owner_id: 'eq.' + account.uid, state: 'in.(approved,revoked)', order: 'created_at.desc', limit: '100' });
      const rows = await db(env, 'ifund_device_authorizations?' + params.toString(), {}, fetcher);
      return response(200, Array.isArray(rows) ? rows : []);
    }
    return response(405, { error: 'Method not allowed.' });
  } catch (error) {
    if (error instanceof BodyError) return response(error.status, { error: error.message });
    // Fail closed on database, rate-limit RPC, or configuration errors.
    return response(503, { error: 'Device authorization is temporarily unavailable.' });
  }
}
