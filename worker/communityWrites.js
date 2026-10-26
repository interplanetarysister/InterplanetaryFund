import { authenticatedUser, migrationReady, response } from './reads.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_POST_BYTES = 4_096;
const SELECT = 'id,author_id,body,created_at';

function jsonHeaders(env, jwt) {
  // Do not substitute a modern Supabase publishable key for an Auth bearer.
  return {
    apikey: env.SUPABASE_PUBLISHABLE_KEY,
    Authorization: 'Bearer ' + jwt,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Prefer: 'return=representation',
  };
}

function validatePost(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  // author_id, moderation flags, timestamps and all other privileged fields
  // are server-derived or database-owned, never supplied by the browser.
  if (Object.keys(raw).length !== 1 || typeof raw.body !== 'string') return null;
  const body = raw.body.trim();
  if (body.length < 1 || body.length > 2000) return null;
  return body;
}

/** Independently owned community post writes, gated until Supabase/Auth parity. */
export async function routeCommunityWrite(request, env, fetcher = fetch) {
  const pathname = new URL(request.url).pathname;
  const isCreate = pathname === '/api/community/posts' && request.method === 'POST';
  const target = /^\/api\/community\/posts\/([^/]+)$/.exec(pathname);
  const isDelete = Boolean(target) && request.method === 'DELETE';
  if (!isCreate && !isDelete) {
    if (pathname === '/api/community/posts' || target) {
      return response(405, { error: 'Method not allowed.' });
    }
    return response(404, { error: 'Not found.' });
  }
  if (!migrationReady(env)) {
    return response(503, { error: 'Independent migration API not enabled.' });
  }
  if (target && !UUID.test(target[1])) {
    return response(400, { error: 'Invalid post ID.' });
  }
  if (isCreate &&
      !/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('content-type') || '')) {
    return response(415, { error: 'JSON request body required.' });
  }
  if (isCreate && Number(request.headers.get('content-length')) > MAX_POST_BYTES) {
    return response(413, { error: 'Request too large.' });
  }

  try {
    const account = await authenticatedUser(request, env, fetcher);
    if (!account) return response(401, { error: 'Sign in to update the community.' });

    let url = env.SUPABASE_URL + '/rest/v1/ifund_posts?';
    let body;
    if (isCreate) {
      const rawText = await request.text();
      if (new TextEncoder().encode(rawText).byteLength > MAX_POST_BYTES) {
        return response(413, { error: 'Request too large.' });
      }
      let payload;
      try {
        payload = JSON.parse(rawText);
      } catch {
        return response(400, { error: 'Invalid JSON.' });
      }
      const message = validatePost(payload);
      if (!message) return response(422, { error: 'Post must contain 1–2000 characters.' });
      body = JSON.stringify({ author_id: account.uid, body: message });
      url += new URLSearchParams({ select: SELECT });
    } else {
      url += new URLSearchParams({
        select: SELECT, id: 'eq.' + target[1], author_id: 'eq.' + account.uid,
      });
    }

    const upstream = await fetcher(url, {
      method: isCreate ? 'POST' : 'DELETE',
      headers: jsonHeaders(env, account.jwt),
      ...(isCreate ? { body } : {}),
    });
    if (!upstream.ok) {
      return response(503, { error: 'Community update unavailable.' });
    }
    const rows = await upstream.json();
    if (!Array.isArray(rows)) {
      return response(503, { error: 'Community update could not be verified.' });
    }
    if (rows.length === 0 && isDelete) return response(404, { error: 'Post not found.' });
    if (rows.length !== 1 || !UUID.test(rows[0]?.id || '') ||
        rows[0]?.author_id !== account.uid ||
        (isDelete && rows[0].id?.toLowerCase() !== target[1].toLowerCase())) {
      return response(503, { error: 'Community update could not be verified.' });
    }
    if (isCreate && rows[0].body !== JSON.parse(body).body) {
      return response(503, { error: 'Community update could not be verified.' });
    }
    return response(isCreate ? 201 : 200, isCreate
      ? { id: rows[0].id, body: rows[0].body, created_at: rows[0].created_at }
      : { id: rows[0].id, deleted: true });
  } catch {
    return response(503, { error: 'Community update unavailable.' });
  }
}
