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

async function read(env, path, account, fetcher) {
  const result = await fetcher(env.SUPABASE_URL + '/rest/v1/' + path, {
    method: 'GET',
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: 'Bearer ' + account.jwt,
      Accept: 'application/json',
    },
  });
  if (!result.ok) throw new Error('giving data unavailable');
  const data = await result.json();
  if (!Array.isArray(data)) throw new Error('giving data malformed');
  return data;
}

/** Read only captured gifts visible under donor-scoped database grants and RLS. */
export async function routeGivingRead(request, env, fetcher = fetch) {
  if (new URL(request.url).pathname !== '/api/giving/mine') return response(404, { error: 'Not found.' });
  if (request.method !== 'GET') return response(405, { error: 'Method not allowed.' });
  if (!ready(env)) return response(503, { error: 'Giving history is not enabled.' });
  try {
    const account = await authenticatedUser(request, env, fetcher);
    if (!account) return response(401, { error: 'Sign in to view your giving history.' });
    const denied = accountGuardResponse(account);
    if (denied) return denied;

    const donationParams = new URLSearchParams({
      select: 'id,donor_id,campaign_id,gift_cents,optional_support_cents,currency,status,captured_at',
      donor_id: 'eq.' + account.uid,
      status: 'eq.captured',
      order: 'captured_at.desc',
      limit: '1001',
    });
    const rows = await read(env, 'ifund_donations?' + donationParams.toString(), account, fetcher);
    if (rows.length > 1000) return response(409, { error: 'Giving history is too large to verify in one request.' });

    const seen = new Set();
    for (const row of rows) {
      if (!row || !UUID.test(row.id || '') || row.donor_id !== account.uid ||
          !UUID.test(row.campaign_id || '') || row.status !== 'captured' || row.currency !== 'USD' ||
          !Number.isSafeInteger(row.gift_cents) || row.gift_cents <= 0 ||
          !Number.isSafeInteger(row.optional_support_cents) || row.optional_support_cents < 0 ||
          !Number.isFinite(Date.parse(row.captured_at || '')) || seen.has(row.id)) {
        return response(503, { error: 'Giving history could not be verified.' });
      }
      seen.add(row.id);
    }

    const campaignIds = [...new Set(rows.map(row => row.campaign_id))];
    const titles = new Map();
    for (let offset = 0; offset < campaignIds.length; offset += 100) {
      const batch = campaignIds.slice(offset, offset + 100);
      const params = new URLSearchParams({
        select: 'id,title',
        id: 'in.(' + batch.join(',') + ')',
      });
      const campaigns = await read(env, 'ifund_campaigns?' + params.toString(), account, fetcher);
      for (const campaign of campaigns) {
        if (!campaign || !UUID.test(campaign.id || '') || !batch.includes(campaign.id) ||
            typeof campaign.title !== 'string') {
          return response(503, { error: 'Giving history could not be verified.' });
        }
        titles.set(campaign.id, campaign.title);
      }
    }

    return response(200, { donations: rows.map(row => ({
      id: row.id,
      campaign_id: row.campaign_id,
      campaign_title: titles.get(row.campaign_id) || 'Campaign',
      amount: row.gift_cents / 100,
      platform_support_amount: row.optional_support_cents / 100,
      created_date: row.captured_at,
      payment_method: 'PayPal',
    })) });
  } catch {
    return response(503, { error: 'We could not load your confirmed giving history.' });
  }
}
