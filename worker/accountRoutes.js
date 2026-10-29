import { readJsonBody, BodyError } from './bodyLimit.js';
import { authenticatedUser, migrationReady, response } from './reads.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const profileSelect = 'id,handle,display_name,created_at';
const connectionSelect = 'id,provider,status,verified_at,created_at';

/** Private owner-only profile and provider status API. No roles or OAuth writes. */
export async function routeAccountRequest(request, env, fetcher = fetch) {
  const path = new URL(request.url).pathname;
  const allowed = (
    (path === '/api/account/me' && request.method === 'GET') ||
    (path === '/api/account/profile' && ['GET', 'PUT'].includes(request.method)) ||
    (path === '/api/account/connections' && request.method === 'GET')
  );
  if (!allowed) {
    if (path.startsWith('/api/account/')) {
      return response(405, { error: 'Method not allowed.' });
    }
    return response(404, { error: 'Not found.' });
  }
  if (!migrationReady(env)) {
    return response(503, { error: 'Independent migration API not enabled.' });
  }

  if (request.method === 'PUT' &&
      !/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('content-type') || '')) {
    return response(415, { error: 'JSON request body required.' });
  }
  try {
    const account = await authenticatedUser(request, env, fetcher);
    if (!account) return response(401, { error: 'Sign in to view your account.' });
    if (path === '/api/account/me') {
      return response(200, { id: account.uid });
    }

    const headers = {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: 'Bearer ' + account.jwt,
      Accept: 'application/json',
    };
    const isWrite = request.method === 'PUT';
    let body;
    let query;
    let table;
    if (path === '/api/account/profile') {
      table = 'ifund_profiles';
      query = new URLSearchParams({
        select: profileSelect,
        ...(isWrite ? { on_conflict: 'id' } : { id: 'eq.' + account.uid, limit: '1' }),
      });
      if (isWrite) {
        if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('content-type') || '')) {
          return response(415, { error: 'JSON request body required.' });
        }
        if (Number(request.headers.get('content-length')) > 2048) {
          return response(413, { error: 'Request too large.' });
        }
        const input = await readJsonBody(request, 2048);
        if (!input || Array.isArray(input) || typeof input !== 'object') {
          return response(422, { error: 'Invalid profile.' });
        }
        const fields = Object.keys(input);
        if (fields.length === 0 || fields.some((name) => !['handle', 'display_name'].includes(name))) {
          return response(422, { error: 'Invalid profile fields.' });
        }
        const updated = { id: account.uid };
        if (Object.hasOwn(input, 'handle')) {
          if (input.handle !== null && (typeof input.handle !== 'string' ||
            (input.handle !== '' && !/^[A-Za-z0-9_-]{3,32}$/.test(input.handle)))) {
            return response(422, { error: 'Handle must be 3–32 letters, numbers, underscores or dashes.' });
          }
          updated.handle = input.handle || null;
        }
        if (Object.hasOwn(input, 'display_name')) {
          if (typeof input.display_name !== 'string' || input.display_name.trim().length > 100) {
            return response(422, { error: 'Invalid display name.' });
          }
          updated.display_name = input.display_name.trim();
        }
        body = JSON.stringify(updated);
        headers['Content-Type'] = 'application/json';
        headers.Prefer = 'resolution=merge-duplicates,return=representation';
      }
    } else {
      table = 'ifund_connections';
      query = new URLSearchParams({
        select: connectionSelect,
        owner_id: 'eq.' + account.uid,
        order: 'created_at.desc',
        limit: '50',
      });
    }
    const result = await fetcher(env.SUPABASE_URL + '/rest/v1/' + table + '?' + query, {
      method: isWrite ? 'POST' : 'GET',
      headers,
      ...(body ? { body } : {}),
    });
    if (!result.ok) return response(503, { error: 'Account data unavailable.' });
    const rows = await result.json();
    if (!Array.isArray(rows)) return response(503, { error: 'Account data unavailable.' });
    if (path === '/api/account/connections') {
      if (rows.length > 50 || rows.some(row => !row || typeof row.provider !== 'string' ||
          !['disconnected', 'pending', 'connected', 'error'].includes(row.status))) {
        return response(503, { error: 'Account data unavailable.' });
      }
      // Never claim "connected" when provider verification time is missing.
      return response(200, rows.map(row => ({
        provider: row.provider,
        status: row.status === 'connected' && !row.verified_at ? 'pending' : row.status,
        verified_at: row.verified_at,
      })));
    }
    if (rows.length > 1 || rows.some(row => row?.id !== account.uid)) {
      return response(503, { error: 'Account data unavailable.' });
    }
    if (isWrite && rows.length !== 1) {
      return response(503, { error: 'Account update could not be verified.' });
    }
    return response(200, rows[0] || null);
  } catch (error) {
    if (error instanceof BodyError) return response(error.status, { error: error.message });
    return response(503, { error: 'Account data unavailable.' });
  }
}
