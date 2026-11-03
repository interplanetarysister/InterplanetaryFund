import { readJsonBody, BodyError } from './bodyLimit.js';
import { authenticatedStudioUser, accountGuardResponse, studioReady, response } from './reads.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BLOCK_TYPES = new Set(['hero', 'text', 'card', 'button', 'image']);
const PAGE_SELECT = 'id,slug,title,content,status,created_at,updated_at,published_at,updated_by';
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
    if (typeof input.title !== 'string' || input.title.trim().length < 1 || [...input.title.trim()].length > 120) return null;
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
      if (clean.url) {
        if (clean.url.startsWith('/')) {
          if (clean.url.startsWith('//') || clean.url.includes('\\')) return null;
        } else {
          try {
            const parsed = new URL(clean.url);
            if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) return null;
          } catch { return null; }
        }
      }
      if (clean.imageUrl) {
        try {
          const parsed = new URL(clean.imageUrl);
          if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
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
  if (!studioReady(env)) return response(503, { error: 'IFund Studio API is not enabled.' });
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
    const account = await authenticatedStudioUser(request, env, fetcher);
    if (!account) return response(401, { error: 'Sign in with an administrator account.' });
    const denied = accountGuardResponse(account);
    if (denied) return denied;
    if (account.role !== 'super_admin') return response(403, { error: 'Verified super-administrator access required.' });
    const headers = apiHeaders(env, account.jwt, request.method !== 'GET');
    if (request.method === 'GET') {
      const pageUrl = new URL(request.url);
      const requestedLimit = Number(pageUrl.searchParams.get('limit') || 100);
      const requestedOffset = Number(pageUrl.searchParams.get('offset') || 0);
      const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 100;
      const offset = Number.isSafeInteger(requestedOffset) && requestedOffset >= 0 ? requestedOffset : 0;
      const query = new URLSearchParams({
        select: PAGE_SELECT,
        order: 'updated_at.desc',
        ...(item ? { id: 'eq.' + item[1], limit: '1' } : { limit: String(limit), offset: String(offset) }),
      });
      const upstream = await fetcher(env.SUPABASE_URL + '/rest/v1/ifund_studio_pages?' + query, { headers });
      if (!upstream.ok) return response(503, { error: 'Studio pages are unavailable.' });
      const rows = await upstream.json();
      if (!Array.isArray(rows) || rows.length > limit) return response(503, { error: 'Studio pages are unavailable.' });
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
    let expectedUpdatedAt = null;
    if (request.method === 'PATCH') {
      expectedUpdatedAt = request.headers.get('if-match');
      if (!expectedUpdatedAt || !Number.isFinite(Date.parse(expectedUpdatedAt))) {
        return response(428, { error: 'Refresh this page before saving so changes are not overwritten.' });
      }
    }
    const query = new URLSearchParams({ select: PAGE_SELECT });
    if (item) {
      query.set('id', 'eq.' + item[1]);
      query.set('updated_at', 'eq.' + expectedUpdatedAt);
    }
    const upstream = await fetcher(env.SUPABASE_URL + '/rest/v1/ifund_studio_pages?' + query, {
      method: request.method, headers, body: JSON.stringify(page),
    });
    if (!upstream.ok) {
      if (upstream.status === 409) return response(409, { error: 'A page with this URL slug already exists.' });
      return response(503, { error: 'Studio page could not be saved.' });
    }
    const rows = await upstream.json();
    if (item && Array.isArray(rows) && rows.length === 0) {
      return response(409, { error: 'This page changed elsewhere. Refresh it before saving again.' });
    }
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
  if (!studioReady(env)) return response(503, { error: 'Studio pages are not available.' });
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


/** Generate a validated visual layout draft using the Cloudflare Workers Free AI allocation. */
export async function routeStudioGenerateRequest(request, env, fetcher = fetch) {
  if (request.method !== 'POST') return response(405, { error: 'Method not allowed.' });
  if (!studioReady(env) || env.IFUND_STUDIO_AI_ENABLED !== 'enabled' || typeof env.AI?.run !== 'function') {
    return response(503, { error: 'Studio AI generation is not enabled.' });
  }
  if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('content-type') || '')) {
    return response(415, { error: 'JSON request body required.' });
  }
  try {
    const account = await authenticatedStudioUser(request, env, fetcher);
    if (!account) return response(401, { error: 'Sign in with an administrator account.' });
    const denied = accountGuardResponse(account);
    if (denied) return denied;
    if (account.role !== 'admin') return response(403, { error: 'Administrator access required.' });
    const input = await readJsonBody(request, 6_000);
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.keys(input).some((key) => key !== 'prompt') ||
        typeof input.prompt !== 'string' || input.prompt.trim().length < 8 || input.prompt.length > 1_200) {
      return response(422, { error: 'Describe the page you want in 8–1,200 characters.' });
    }

    const quota = await fetcher(env.SUPABASE_URL + '/rest/v1/rpc/ifund_studio_consume_ai_quota', {
      method: 'POST',
      headers: apiHeaders(env, account.jwt, true),
      body: '{}',
    });
    if (!quota.ok) return response(503, { error: 'Studio AI quota service is unavailable.' });
    if (await quota.json() !== true) {
      return response(429, { error: 'The shared Studio AI limit of two generations per day has been reached.' });
    }

    const result = await env.AI.run('@cf/zai-org/glm-4.7-flash', {
      messages: [
        {
          role: 'system',
          content: 'You design accessible Interplanetary Fund page layouts. Return one JSON object only, with a blocks array of 2 to 8 blocks. Each block must use only type hero, text, card, button, or image; and may contain heading, body, label, url, imageUrl. Do not return HTML, CSS, JavaScript, scripts, arbitrary properties, or markdown. Use concise, useful copy. Use relative internal paths for buttons where possible. For images, leave imageUrl empty unless the user provided a specific HTTPS URL. Never invent facts, testimonials, people, metrics, or donation claims.',
        },
        { role: 'user', content: input.prompt.trim() },
      ],
      max_tokens: 700,
      temperature: 0.35,
    });

    let generated = result?.response ?? result?.result?.response ?? result?.output_text ?? result;
    if (typeof generated === 'string') {
      const cleaned = generated.trim().replace(/^\u0060{3}(?:json)?/i, '').replace(/\u0060{3}$/i, '').trim();
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start < 0 || end <= start) return response(502, { error: 'Studio AI returned an invalid layout. Try a shorter instruction.' });
      generated = JSON.parse(cleaned.slice(start, end + 1));
    }
    const rawBlocks = Array.isArray(generated?.blocks) ? generated.blocks.slice(0, 8) : [];
    const blocks = rawBlocks.map((block, index) => {
      if (!block || typeof block !== 'object' || Array.isArray(block)) return block;
      const clean = { id: 'ai-' + (index + 1), type: block.type };
      for (const field of ['heading', 'body', 'label', 'url', 'imageUrl']) {
        if (typeof block[field] === 'string') clean[field] = block[field].slice(0, 4_000);
      }
      return clean;
    });
    const validated = validatePage({
      slug: 'ai-generated-draft',
      title: 'AI generated draft',
      content: { blocks },
      status: 'draft',
    });
    if (!validated) return response(502, { error: 'Studio AI returned an unsupported layout. Try a more specific instruction.' });
    return response(200, { content: validated.content, dailyLimit: 2 });
  } catch (error) {
    if (error instanceof BodyError) return response(error.status, { error: error.message });
    return response(502, { error: 'Studio AI could not generate a safe layout. Try again later.' });
  }
}


export async function routeStudioStatusRequest(request, env, fetcher = fetch) {
  if (request.method !== 'GET') return response(405, { error: 'Method not allowed.' });
  if (!studioReady(env)) return response(503, { error: 'IFund Studio API is not enabled.' });
  try {
    const account = await authenticatedStudioUser(request, env, fetcher);
    if (!account) return response(401, { error: 'Sign in with an administrator account.' });
    const denied = accountGuardResponse(account);
    if (denied) return denied;
    if (account.role !== 'admin') return response(403, { error: 'Administrator access required.' });
    return response(200, {
      pageBuilderEnabled: true,
      aiEnabled: env.IFUND_STUDIO_AI_ENABLED === 'enabled' && typeof env.AI?.run === 'function',
      aiDailyLimit: 2,
    });
  } catch {
    return response(503, { error: 'Studio status is unavailable.' });
  }
}


/** Read immutable revisions or restore one revision as a new current revision. */
export async function routeStudioVersionRequest(request, env, fetcher = fetch) {
  if (!studioReady(env)) return response(503, { error: 'IFund Studio API is not enabled.' });
  const path = new URL(request.url).pathname;
  const match = /^\/api\/studio\/pages\/([0-9a-f-]+)\/versions(?:\/([0-9]+)\/restore)?$/i.exec(path);
  if (!match || !UUID.test(match[1])) return response(404, { error: 'Not found.' });
  const restore = Boolean(match[2]);
  if (request.method !== (restore ? 'POST' : 'GET')) return response(405, { error: 'Method not allowed.' });
  const version = restore ? Number(match[2]) : null;
  if (restore && (!Number.isSafeInteger(version) || version < 1 || version > 2_147_483_647)) {
    return response(400, { error: 'Invalid page version.' });
  }
  try {
    const account = await authenticatedStudioUser(request, env, fetcher);
    if (!account) return response(401, { error: 'Sign in with an administrator account.' });
    const denied = accountGuardResponse(account);
    if (denied) return denied;
    if (account.role !== 'admin') return response(403, { error: 'Administrator access required.' });
    const headers = apiHeaders(env, account.jwt, restore);
    if (!restore) {
      const query = new URLSearchParams({
        select: 'id,page_id,version,slug,title,content,status,changed_by,created_at',
        page_id: 'eq.' + match[1],
        order: 'version.desc',
        limit: '30',
      });
      const upstream = await fetcher(env.SUPABASE_URL + '/rest/v1/ifund_studio_page_versions?' + query, { headers });
      if (!upstream.ok) return response(503, { error: 'Page history is unavailable.' });
      const rows = await upstream.json();
      if (!Array.isArray(rows) || rows.length > 30) return response(503, { error: 'Page history is unavailable.' });
      return response(200, rows);
    }

    const versionQuery = new URLSearchParams({
      select: 'page_id,slug,title,content,status',
      page_id: 'eq.' + match[1],
      version: 'eq.' + version,
      limit: '1',
    });
    const versionResponse = await fetcher(env.SUPABASE_URL + '/rest/v1/ifund_studio_page_versions?' + versionQuery, {
      headers: apiHeaders(env, account.jwt),
    });
    if (!versionResponse.ok) return response(503, { error: 'Page version could not be loaded.' });
    const snapshots = await versionResponse.json();
    if (!Array.isArray(snapshots) || snapshots.length !== 1 || snapshots[0].page_id?.toLowerCase() !== match[1].toLowerCase()) {
      return response(404, { error: 'Page version not found.' });
    }
    const expectedUpdatedAt = request.headers.get('if-match');
    if (!expectedUpdatedAt || !Number.isFinite(Date.parse(expectedUpdatedAt))) {
      return response(428, { error: 'Refresh this page before restoring a version.' });
    }
    const snapshot = snapshots[0];
    const collisionQuery = new URLSearchParams({
      select: 'id',
      slug: 'eq.' + snapshot.slug,
      id: 'neq.' + match[1],
      limit: '1',
    });
    const collisionResponse = await fetcher(env.SUPABASE_URL + '/rest/v1/ifund_studio_pages?' + collisionQuery, {
      headers: apiHeaders(env, account.jwt),
    });
    if (!collisionResponse.ok) return response(503, { error: 'Page slug availability could not be checked.' });
    const collisions = await collisionResponse.json();
    if (!Array.isArray(collisions)) return response(503, { error: 'Page slug availability could not be checked.' });
    if (collisions.length) return response(409, { error: 'The historical URL slug is now used by another page. Rename this page before restoring.' });
    const updateQuery = new URLSearchParams({
      select: PAGE_SELECT,
      id: 'eq.' + match[1],
      updated_at: 'eq.' + expectedUpdatedAt,
    });
    const updated = await fetcher(env.SUPABASE_URL + '/rest/v1/ifund_studio_pages?' + updateQuery, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        slug: snapshot.slug,
        title: snapshot.title,
        content: snapshot.content,
        status: 'draft',
        published_at: null,
        updated_by: account.uid,
      }),
    });
    if (!updated.ok) return response(503, { error: 'Page version could not be restored.' });
    const rows = await updated.json();
    if (Array.isArray(rows) && rows.length === 0) return response(409, { error: 'This page changed elsewhere. Refresh before restoring a version.' });
    if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.id?.toLowerCase() !== match[1].toLowerCase() ||
        rows[0]?.updated_by !== account.uid || rows[0]?.status !== 'draft') {
      return response(503, { error: 'Page restore could not be verified.' });
    }
    return response(200, rows[0]);
  } catch {
    return response(503, { error: 'Studio version service unavailable.' });
  }
}
