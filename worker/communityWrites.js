import { readJsonBody, BodyError } from './bodyLimit.js';
import { authenticatedUser, migrationReady, response } from './reads.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_POST_BYTES = 4_096;
const SELECT = 'id,author_id,body,media_id,created_at';
// Mirrors the member-media library contract in worker/media/memberMedia.js:
// an attachment must resolve to the author's own verified R2 library item.
const ATTACHABLE_MEDIA = Object.freeze({
  'image/png': ['image', 'png', 5242880],
  'image/jpeg': ['image', 'jpg', 5242880],
  'image/webp': ['image', 'webp', 5242880],
  'image/gif': ['image', 'gif', 5242880],
  'video/mp4': ['video', 'mp4', 41943040],
  'video/webm': ['video', 'webm', 41943040],
});

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
  // The only optional client field is media_id, an opaque library reference
  // that is worthless until verifyAttachedMedia proves ownership below.
  const keys = Object.keys(raw);
  if (!keys.includes('body') || keys.some(key => !['body', 'media_id'].includes(key)) ||
      typeof raw.body !== 'string') return null;
  const body = raw.body.trim();
  if (body.length < 1 || body.length > 2000) return null;
  let mediaId = null;
  if (raw.media_id !== undefined && raw.media_id !== null) {
    if (typeof raw.media_id !== 'string' || !UUID.test(raw.media_id)) return null;
    mediaId = raw.media_id;
  }
  return { body, mediaId };
}

/** Owner-scoped library lookup with the author's own bearer, mirroring the
 * integrity checks memberMedia applies before serving a private file. */
async function verifyAttachedMedia(env, fetcher, account, mediaId) {
  const query = new URLSearchParams({
    select: 'id,owner_id,content_kind,content_type,file_size,object_path,object_etag,object_sha256,deletion_requested_at',
    id: 'eq.' + mediaId,
    owner_id: 'eq.' + account.uid,
    limit: '1',
  });
  const upstream = await fetcher(env.SUPABASE_URL + '/rest/v1/ifund_member_media?' + query, {
    method: 'GET',
    headers: jsonHeaders(env, account.jwt),
  });
  if (!upstream.ok) throw new Error('Attached media lookup unavailable.');
  const rows = await upstream.json();
  if (!Array.isArray(rows) || rows.length !== 1) return null;
  const item = rows[0];
  const rule = ATTACHABLE_MEDIA[item.content_type];
  if (!rule || item.id !== mediaId || item.owner_id !== account.uid ||
      item.content_kind !== rule[0] ||
      !Number.isInteger(item.file_size) || item.file_size < 1 || item.file_size > rule[2] ||
      item.object_path !== `private/member-media/${account.uid}/${mediaId}.${rule[1]}` ||
      typeof item.object_etag !== 'string' || !item.object_etag ||
      !/^[a-f0-9]{64}$/.test(item.object_sha256 || '') ||
      item.deletion_requested_at) return null;
  return item;
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
    let mediaId = null;
    if (isCreate) {
      const payload = await readJsonBody(request, MAX_POST_BYTES);
      const message = validatePost(payload);
      if (!message) return response(422, { error: 'Post must contain 1–2000 characters.' });
      mediaId = message.mediaId;
      if (mediaId && !(await verifyAttachedMedia(env, fetcher, account, mediaId))) {
        return response(422, { error: 'Attached media could not be verified.' });
      }
      body = JSON.stringify({ author_id: account.uid, body: message.body,
        ...(mediaId ? { media_id: mediaId } : {}) });
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
    if (isCreate && (rows[0].body !== JSON.parse(body).body ||
        (mediaId && rows[0].media_id !== mediaId) ||
        (!mediaId && rows[0].media_id !== null && rows[0].media_id !== undefined))) {
      return response(503, { error: 'Community update could not be verified.' });
    }
    return response(isCreate ? 201 : 200, isCreate
      ? { id: rows[0].id, body: rows[0].body, created_at: rows[0].created_at,
          ...(mediaId ? { media_id: mediaId } : {}) }
      : { id: rows[0].id, deleted: true });
  } catch (error) {
    if (error instanceof BodyError) return response(error.status, { error: error.message });
    return response(503, { error: 'Community update unavailable.' });
  }
}
