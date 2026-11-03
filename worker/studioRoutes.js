import { readJsonBody, BodyError } from './bodyLimit.js';
import { authenticatedUser, migrationReady, response } from './reads.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BLOCK_TYPES = new Set(['hero', 'text', 'card', 'button', 'image']);
const PAGE_SELECT = 'id,slug,title,content,status,created_at,updated_at,published_at';
const MAX_BODY = 48_000;

function validatePage(input, partial = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const allowed = new Set(['slug', 'title', 'content', 'status']);
  const keys = Object.keys(input);
  if (!keys.length || keys.some((key) => !allowed.has(key))) return null;
  const out = {};
  if (Object.hasOwn(input, 'slug')) {
    if (typeof input.slug !== 'string' || input.slug.length < 3 || input.slug.length > 60 || !SLUG.test(input.slug)) return null;
    out.slug = input.slug;
  } else if (!partial) return null;
  if (Object.hasOwn(input, 'title')) {
    if (typeof input.title !== 'string' || input.title.trim().length < 1 || input.title.trim().length > 120) return null;
    out.title = input.title.trim();
  } else if (!partial) return null;
  if (Object.hasOwn(input, 'status')) {
    if (!['draft', 'published'].includes(input.status)) return null;
    out.status = input.status;
  }
  if (Object.hasOwn(input, 'content')) {
    const content = input.content;
    if (!content || typeof content !== 'object' || Array.isArray(content) || !Array.isArray(content.blocks) || content.blocks.length > 40) return null;
    const ids = new Set();
    const blocks = [];
    for (const block of content.blocks) {
      if (!block || typeof block !== 'object' || Array.isArray(block) || !BLOCK_TYPES.has(block.type) ||
          typeof block.id !== 'string' || !/^[a-zA-Z0-9_-]{1,48}$/.test(block.id) || ids.has(block.id)) return null;
      ids.add(block.id);
      const allowedFields = new Set(['id', 'type', 'heading', 'body', 'label', 'url', 'imageUrl']);
      if (Object.keys(block).some((key) => !allowedFields.has(key))) return null;
      const clean = { id: block.id, type: block.type };
      for (const field of ['heading', 'body', 'label', 'url', 'imageUrl']) {
        if (Object.hasOwn(block, field)) {
          if (typeof block[field] !== 'string' || block[field].length > 4000) return null;
          clean[field] = block[field].trim();
        }
      }
      for (const field of ['url', 'imageUrl']) {
        if (!clean[field]) continue;
        try {
          const parsed = new URL(clean[field]);
          if (parsed.username || parsed.password ||
              (field === 'imageUrl' ? parsed.protocol !== 'https:' : !['https:', 'http:'].includes(parsed.protocol))) return null;
        } catch { return null; }
      }
      blocks.push(clean);
    }
    out.content = { blocks };
  } else if (!partial) return null;
  return out;
}
function apiHeaders(env, jwt, write = false) {
  return {
    apikey: env.SUPABASE_PUBLISHABLE_KEY,
    Authorization: 'Bearer ' + jwt,
    Accept: 'application/json',
    ...(write ? { 'Content-Type': 'application/json', Prefer: 'return=representation' } : {}),
  };
}

/** Admin-only API; Postgres RLS independently enforces the same role. */
export async function routeStudioRequest(request, env, fetcher = fetch) {
  if (!migrationReady(env)) return response(503, { error: 'IFund Studio API is not enabled.' });
  const path = new URL(request.url).pathname;
  const collection = path === '/api/studio/pages';
  const item = /^\/api\/studio\/pages\/([^/]+)$/i.exec(path);
  if (!collection && !item) return response(404, { error: 'Not found.' });
  if (!['GET', 'POST', 'PATCH'].includes(request.method)) return response(405, { error: 'Method not allowed.' });
  if (request.method === 'POST' && !collection) return response(405, { error: 'Method not allowed.' });
  if (request.method === 'PATCH' && (!item || !UUID.test(item[1]))) return response(400, { error: 'Invalid page ID.' });
  if (request.method !== 'GET' && !/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('content-type') || '')) {
    return response(415, { error: 'JSON request body required.' });
  }
  try {
    const account = await authenticatedUser(request, env, fetcher);
    if (!account) return response(401, { error: 'Sign in with an administrator account.' });
    if (!['admin', 'super_admin'].includes(account.role)) return response(403, { error: 'Administrator access required.' });
    const headers = apiHeaders(env, account.jwt, request.method !== 'GET');
    if (request.method === 'GET') {
      const query = new URLSearchParams({ select: PAGE_SELECT, order: 'updated_at.desc',
        ...(item ? { id: 'eq.' + item[1], limit: '1' } : { limit: '100' }) });
      const upstream = await fetcher(env.SUPABASE_URL + '/rest/v1/ifund_studio_pages?' + query, { headers });
      if (!upstream.ok) return response(503, { error: 'Studio pages are unavailable.' });
      const rows = await upstream.json();
      if (!Array.isArray(rows) || rows.length > 100) return response(503, { error: 'Studio pages are unavailable.' });
      return response(200, rows);
    }
    if (Number(request.headers.get('content-length') || 0) > MAX_BODY) return response(413, { error: 'Studio document is too large.' });
    const input = await readJsonBody(request, MAX_BODY);
    const page = validatePage(input, request.method === 'PATCH');
    if (!page) return response(422, { error: 'Invalid studio page document.' });
    if (request.method === 'POST') {
      page.created_by = account.uid;
      page.updated_by = account.uid;
      page.status ??= 'draft';
      page.published_at = page.status === 'published' ? new Date().toISOString() : null;
    } else {
      page.updated_by = account.uid;
      if (page.status === 'published') page.published_at = new Date().toISOString();
      if (page.status === 'draft') page.published_at = null;
    }
    const query = new URLSearchParams({ select: PAGE_SELECT });
    if (item) query.set('id', 'eq.' + item[1]);
    const upstream = await fetcher(env.SUPABASE_URL + '/rest/v1/ifund_studio_pages?' + query, {
      method: request.method, headers, body: JSON.stringify(page),
    });
    if (!upstream.ok) return response(503, { error: 'Studio page could not be saved.' });
    const rows = await upstream.json();
    if (!Array.isArray(rows) || rows.length !== 1 ||
        (item && rows[0]?.id?.toLowerCase() !== item[1].toLowerCase()) || rows[0]?.updated_by !== account.uid) {
      return response(503, { error: 'Studio save could not be verified.' });
    }
    return response(request.method === 'POST' ? 201 : 200, rows[0]);
  } catch (error) {
    if (error instanceof BodyError) return response(error.status, { error: error.message });
    return response(503, { error: 'Studio service unavailable.' });
  }
}

/** Public read-only renderer endpoint. RLS exposes published pages only. */
export async function routePublicStudioPage(request, env, fetcher = fetch) {
  if (request.method !== 'GET') return response(405, { error: 'Method not allowed.' });
  if (!migrationReady(env)) return response(503, { error: 'Studio pages are not available.' });
  const match = /^\/api\/public\/studio\/pages\/([a-z0-9]+(?:-[a-z0-9]+)*)$/i.exec(new URL(request.url).pathname);
  if (!match || match[1].length > 60) return response(404, { error: 'Page not found.' });
  try {
    const query = new URLSearchParams({
      select: 'id,slug,title,content,status,updated_at',
      slug: 'eq.' + match[1].toLowerCase(),
      status: 'eq.published',
      limit: '1',
    });
    const upstream = await fetcher(env.SUPABASE_URL + '/rest/v1/ifund_studio_pages?' + query, {
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Accept: 'application/json' },
    });
    if (!upstream.ok) return response(503, { error: 'Studio page is unavailable.' });
    const rows = await upstream.json();
    if (!Array.isArray(rows) || rows.length > 1) return response(503, { error: 'Studio page is unavailable.' });
    if (!rows.length || rows[0]?.status !== 'published') return response(404, { error: 'Page not found.' });
    return response(200, rows[0]);
  } catch {
    return response(503, { error: 'Studio page is unavailable.' });
  }
}
