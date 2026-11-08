import { readJsonBody, BodyError } from './bodyLimit.js';
import { authenticatedUser, migrationReady, response } from './reads.js';

// Only campaign content may be written. Never accept ownership, balances,
// provider receipts, withdrawal metadata or other privileged fields.
const ALLOWED = new Set([
  'title', 'summary', 'story', 'category', 'goal_amount', 'cover_image_url', 'status',
]);
const CATEGORIES = new Set([
  'medical', 'emergency', 'education', 'community', 'animals',
  'business', 'creative', 'memorial', 'disaster_relief', 'environment', 'other',
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
        field === 'cover_image_url' ? 2_000 :
        field === 'summary' ? 600 : 150;
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
  if (!['POST', 'PATCH', 'DELETE'].includes(request.method))
    return response(405, { error: 'Method not allowed.' });
  if (!migrationReady(env))
    return response(503, { error: 'Independent migration API not enabled.' });
  const pathname = new URL(request.url).pathname;
  const create = pathname === '/api/campaigns' && request.method === 'POST';
  const updateMatch = /^\/api\/campaigns\/([^/]+)$/.exec(pathname);
  if (!create && !(['PATCH', 'DELETE'].includes(request.method) && updateMatch))
    return response(pathname === '/api/campaigns' ? 405 : 404, {
      error: pathname === '/api/campaigns' ? 'Method not allowed.' : 'Not found.',
    });
  if (updateMatch && !UUID.test(updateMatch[1]))
    return response(400, { error: 'Invalid campaign ID.' });
  if (request.method !== 'DELETE' && !/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('content-type') || ''))
    return response(415, { error: 'JSON request body required.' });
  if (request.method !== 'DELETE' && Number(request.headers.get('content-length')) > MAX_BYTES)
    return response(413, { error: 'Request too large.' });
  try {
    const account = await authenticatedUser(request, env, fetcher);
    if (!account) return response(401, { error: 'Sign in to save a campaign.' });
    const deleting = request.method === 'DELETE';
    let campaign;
    if (!deleting) {
      const body = await readJsonBody(request, MAX_BYTES);
      campaign = validatePayload(body, create);
      if (!campaign)
        return response(422, { error: 'Invalid or incomplete campaign fields.' });
      if (create) campaign.owner_id = account.uid;
    }
    let existing = null;
    if (updateMatch) {
      const readQuery = new URLSearchParams({
        select: SELECT,
        id: 'eq.' + updateMatch[1],
        owner_id: 'eq.' + account.uid,
        limit: '1',
      });
      const read = await fetcher(
        env.SUPABASE_URL + '/rest/v1/ifund_campaigns?' + readQuery,
        { method: 'GET', headers: apiHeaders(env, account.jwt) },
      );
      if (!read.ok) return response(503, { error: 'Campaign save unavailable.' });
      const rows = await read.json();
      if (!Array.isArray(rows)) return response(503, { error: 'Campaign save unavailable.' });
      if (!rows.length) return response(404, { error: 'Campaign not found or not editable.' });
      if (rows.length !== 1 || rows[0]?.owner_id !== account.uid || !rows[0]?.updated_at)
        return response(503, { error: 'Campaign save could not be verified.' });
      existing = rows[0];
      if (deleting && existing.status !== 'draft')
        return response(404, { error: 'Campaign not found or not editable.' });
      if (!deleting) {
        const nextStatus = campaign.status ?? existing.status;
        if (!['draft', 'active'].includes(nextStatus))
          return response(422, { error: 'This campaign status cannot be changed here.' });
        const merged = { ...existing, ...campaign, status: nextStatus };
        if (nextStatus === 'active' &&
            (!String(merged.title || '').trim() ||
             !String(merged.summary || '').trim() ||
             !String(merged.story || '').trim() ||
             !(Number(merged.goal_amount) > 0)))
          return response(422, { error: 'Complete the campaign before publishing.' });
        campaign.status = nextStatus;
      }
    }
    const query = new URLSearchParams({ select: SELECT });
    if (updateMatch) {
      query.set('id', 'eq.' + updateMatch[1]);
      query.set('owner_id', 'eq.' + account.uid);
      query.set('status', 'eq.' + existing.status);
      // The database touch trigger advances updated_at on every write. This
      // prevents a stale Worker request from overwriting a newer same-status edit.
      query.set('updated_at', 'eq.' + existing.updated_at);
    }
    if (!deleting) {
      // The browser helper is not a security boundary. Enforce the same
      // current, versioned legal acceptance on this independent Worker path.
      const terms = await fetcher(
        env.SUPABASE_URL + '/rest/v1/rpc/ifund_current_user_has_current_terms',
        {
          method: 'POST',
          headers: { ...apiHeaders(env, account.jwt), 'Content-Type': 'application/json' },
          body: '{}',
        },
      );
      if (!terms.ok) return response(503, { error: 'Campaign terms could not be verified.' });
      if ((await terms.json()) !== true)
        return response(403, { error: 'Review and accept the current member agreement before saving or publishing.' });
    }
    const upstream = await fetcher(env.SUPABASE_URL + '/rest/v1/ifund_campaigns?' + query, {
      method: create ? 'POST' : deleting ? 'DELETE' : 'PATCH',
      headers: apiHeaders(env, account.jwt),
      ...(deleting ? {} : { body: JSON.stringify(campaign) }),
    });
    if (!upstream.ok) return response(503, { error: 'Campaign save unavailable.' });
    const rows = await upstream.json();
    if (!Array.isArray(rows))
      return response(503, { error: 'Campaign save unavailable.' });
    if (!rows.length)
      return response(404, { error: 'Campaign not found or not editable.' });
    const saved = rows[0];
    if (rows.length !== 1 || saved?.owner_id !== account.uid ||
        (updateMatch && saved.id?.toLowerCase() !== updateMatch[1].toLowerCase()) ||
        (deleting && saved.status !== 'draft'))
      return response(503, { error: 'Campaign save could not be verified.' });
    if (deleting) return response(200, { id: saved.id, deleted: true });
    return response(create ? 201 : 200, {
      id: saved.id, status: saved.status, updated_at: saved.updated_at,
    });
  } catch (error) {
    if (error instanceof BodyError) return response(error.status, { error: error.message });
    return response(503, { error: 'Campaign save unavailable.' });
  }
}
