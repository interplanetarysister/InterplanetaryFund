import { authenticatedUser, migrationReady, response } from './reads.js';

// Only campaign content may be written. Never accept ownership, balances,
// provider receipts, withdrawal metadata or other privileged fields.
const ALLOWED = new Set([
  'title', 'summary', 'story', 'category', 'goal_amount', 'cover_image_url', 'status',
]);
const CATEGORIES = new Set([
  'community', 'medical', 'emergency', 'education', 'animals',
  'business', 'creative', 'other',
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES = 32_768;
const SELECT = 'id,owner_id,title,summary,story,category,goal_amount,cover_image_url,status,created_at,updated_at';

function validatePayload(raw, isCreate) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (Object.keys(raw).length === 0 ||
      Object.keys(raw).some((key) => !ALLOWED.has(key))) return null;
  const data = {};
  for (const field of ['title', 'summary', 'story', 'cover_image_url']) {
    if (Object.hasOwn(raw, field)) {
      if (typeof raw[field] !== 'string') return null;
      const max = field === 'story' ? 15_000 :
        field === 'cover_image_url' ? 2_048 :
        field === 'summary' ? 600 : 120;
      if (raw[field].length > max) return null;
      data[field] = raw[field].trim();
    }
  }
  if (Object.hasOwn(raw, 'category')) {
    if (typeof raw.category !== 'string' || !CATEGORIES.has(raw.category)) return null;
    data.category = raw.category;
  }
  if (Object.hasOwn(raw, 'status')) {
    if (raw.status !== 'draft' && raw.status !== 'active') return null;
    data.status = raw.status;
  }
  if (Object.hasOwn(raw, 'goal_amount')) {
    const value = raw.goal_amount;
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    const str = String(value);
    if (!/^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,2})?$/.test(str)) return null;
    const amount = Number(str);
    if (!Number.isFinite(amount)) return null;
    data.goal_amount = amount;
  }
  if (Object.hasOwn(data, 'cover_image_url') && data.cover_image_url) {
    try {
      const url = new URL(data.cover_image_url);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    } catch { return null; }
  }
  if (isCreate) data.status ??= 'draft';
  // A publish transition always supplies a complete, validated payload.
  if (data.status === 'active' &&
    (!data.title || !data.summary || !data.story ||
      !data.goal_amount || data.goal_amount <= 0)) return null;
  return data;
}
function apiHeaders(env, jwt) {
  return {
    apikey: env.SUPABASE_PUBLISHABLE_KEY,
    Authorization: 'Bearer ' + jwt,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

/** Write as verified user through Supabase RLS; never use service_role. */
export async function routeCampaignWrite(request, env, fetcher = fetch) {
  if (!['POST', 'PATCH'].includes(request.method))
    return response(405, { error: 'Method not allowed.' });
  if (!migrationReady(env))
    return response(503, { error: 'Independent migration API not enabled.' });
  const pathname = new URL(request.url).pathname;
  const create = pathname === '/api/campaigns' && request.method === 'POST';
  const updateMatch = /^\/api\/campaigns\/([^/]+)$/.exec(pathname);
  if (!create && !(request.method === 'PATCH' && updateMatch))
    return response(404, { error: 'Not found.' });
  if (updateMatch && !UUID.test(updateMatch[1]))
    return response(400, { error: 'Invalid campaign ID.' });
  if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('content-type') || ''))
    return response(415, { error: 'JSON request body required.' });
  if (Number(request.headers.get('content-length')) > MAX_BYTES)
    return response(413, { error: 'Request too large.' });
  try {
    const account = await authenticatedUser(request, env, fetcher);
    if (!account) return response(401, { error: 'Sign in to save a campaign.' });
    const rawText = await request.text();
    if (new TextEncoder().encode(rawText).byteLength > MAX_BYTES)
      return response(413, { error: 'Request too large.' });
    let body;
    try { body = JSON.parse(rawText); }
    catch { return response(400, { error: 'Invalid JSON.' }); }
    const campaign = validatePayload(body, create);
    if (!campaign)
      return response(422, { error: 'Invalid or incomplete campaign fields.' });
    if (create) campaign.owner_id = account.uid;
    const query = new URLSearchParams({ select: SELECT });
    if (updateMatch) {
      query.set('id', 'eq.' + updateMatch[1]);
      query.set('owner_id', 'eq.' + account.uid);
    }
    const upstream = await fetcher(env.SUPABASE_URL + '/rest/v1/ifund_campaigns?' + query, {
      method: create ? 'POST' : 'PATCH',
      headers: apiHeaders(env, account.jwt),
      body: JSON.stringify(campaign),
    });
    if (!upstream.ok) return response(503, { error: 'Campaign save unavailable.' });
    const rows = await upstream.json();
    if (!Array.isArray(rows))
      return response(503, { error: 'Campaign save unavailable.' });
    if (!rows.length)
      return response(404, { error: 'Campaign not found or not editable.' });
    const saved = rows[0];
    if (rows.length !== 1 || saved?.owner_id !== account.uid ||
        (updateMatch && saved.id?.toLowerCase() !== updateMatch[1].toLowerCase()))
      return response(503, { error: 'Campaign save could not be verified.' });
    return response(create ? 201 : 200, {
      id: saved.id, status: saved.status, updated_at: saved.updated_at,
    });
  } catch {
    return response(503, { error: 'Campaign save unavailable.' });
  }
}
