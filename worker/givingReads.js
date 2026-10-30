import { authenticatedUser, accountGuardResponse, response } from './reads.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ready(env) {
  let url;
  try { url = new URL(env?.SUPABASE_URL); } catch { return false; }
  return env?.MIGRATION_API_PREVIEW === 'enabled' && url.protocol === 'https:' &&
    url.hostname.toLowerCase() === 'ssibsfmtodgximseeqsv.supabase.co' &&
    url.pathname === '/' && !url.search && !url.hash &&
    typeof env?.SUPABASE_PUBLISHABLE_KEY === 'string' && env.SUPABASE_PUBLISHABLE_KEY.length > 0;
}

/** Read only provider-captured donations through a caller-scoped database RPC. */
export async function routeGivingRead(request, env, fetcher = fetch) {
  if (new URL(request.url).pathname !== '/api/giving/mine') return response(404, { error: 'Not found.' });
  if (request.method !== 'GET') return response(405, { error: 'Method not allowed.' });
  if (!ready(env)) return response(503, { error: 'Giving history is not enabled.' });
  try {
    const account = await authenticatedUser(request, env, fetcher);
    if (!account) return response(401, { error: 'Sign in to view your giving history.' });
    const denied = accountGuardResponse(account);
    if (denied) return denied;

    // The database function enforces auth.uid(), active lifecycle state, and
    // captured-only filtering. No service-role credential or client-supplied
    // donor ID is used anywhere in this read path.
    const result = await fetcher(env.SUPABASE_URL + '/rest/v1/rpc/ifund_get_my_giving_history', {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        Authorization: 'Bearer ' + account.jwt,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (!result.ok) throw new Error('giving data unavailable');
    const rows = await result.json();
    if (!Array.isArray(rows)) throw new Error('giving data malformed');
    if (rows.length > 1000) return response(409, { error: 'Giving history is too large to verify in one request.' });

    const seen = new Set();
    const donations = [];
    for (const row of rows) {
      if (!row || !UUID.test(row.id || '') || row.donor_id !== account.uid ||
          !UUID.test(row.campaign_id || '') || typeof row.campaign_title !== 'string' ||
          row.status !== 'captured' || row.currency !== 'USD' ||
          !Number.isSafeInteger(row.gift_cents) || row.gift_cents <= 0 ||
          !Number.isSafeInteger(row.optional_support_cents) || row.optional_support_cents < 0 ||
          !Number.isFinite(Date.parse(row.captured_at || '')) || seen.has(row.id)) {
        return response(503, { error: 'Giving history could not be verified.' });
      }
      seen.add(row.id);
      donations.push({
        id: row.id,
        campaign_id: row.campaign_id,
        campaign_title: row.campaign_title || 'Campaign',
        amount: row.gift_cents / 100,
        platform_support_amount: row.optional_support_cents / 100,
        created_date: row.captured_at,
        payment_method: 'PayPal',
      });
    }

    return response(200, { donations });
  } catch {
    return response(503, { error: 'We could not load your confirmed giving history.' });
  }
}
