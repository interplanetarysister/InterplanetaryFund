import { authenticatedUser, migrationReady, response } from './reads.js';
import { readJsonBody, BodyError } from './bodyLimit.js';

const SUPABASE_ORIGIN = 'https://ssibsfmtodgximseeqsv.supabase.co';

/**
 * Independent equivalent of base44/functions/geocodeCity/entry.ts.
 * Read-only: authenticated account lifecycle + the original Nominatim query.
 * No service role, Base44 calls, campaign writes, payments, or auth-claim roles.
 */
export async function geocodeCity(request, env = {}, fetcher = fetch) {
  if (request.method !== 'POST') return response(405, { error: 'Method not allowed.' });
  if (env.IFUND_GEOCODE_ENABLED !== 'enabled' || !migrationReady(env) ||
      env.SUPABASE_URL !== SUPABASE_ORIGIN) {
    return response(503, { error: 'Independent geocoding is not enabled.' });
  }

  // Never forward caller credentials across redirects. The public geocoder
  // receives its own header set, without the Supabase key or caller bearer.
  const boundedFetch = (url, init = {}) => fetcher(url, {
    ...init, redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  let account;
  try { account = await authenticatedUser(request, env, boundedFetch); } catch { /* Fail closed. */ }
  if (!account) return response(401, { error: 'Sign in to continue.' });

  try {
    const params = new URLSearchParams({
      select: 'id,account_status,account_deletion_pending', id: 'eq.' + account.uid, limit: '2',
    });
    const res = await boundedFetch(SUPABASE_ORIGIN + '/rest/v1/ifund_profiles?' + params, {
      method: 'GET', headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        Authorization: 'Bearer ' + account.jwt,
        Accept: 'application/json',
      },
    });
    if (!res.ok) return response(503, { error: 'Account status could not be verified.' });
    const rows = await res.json();
    if (!Array.isArray(rows)) return response(503, { error: 'Account status could not be verified.' });
    if (rows.length !== 1 || rows[0]?.id !== account.uid) {
      return response(401, { error: 'This account is no longer available.' });
    }
    const profile = rows[0];
    if (profile.account_status === null || profile.account_deletion_pending === null) {
      return response(403, { error: 'Account access is pending migration verification.' });
    }
    if (typeof profile.account_status !== 'string' || typeof profile.account_deletion_pending !== 'boolean') {
      return response(503, { error: 'Account status could not be verified.' });
    }
    if (profile.account_deletion_pending) {
      return response(403, { error: 'This account is scheduled for deletion and can no longer be used.' });
    }
    if (profile.account_status !== 'active') {
      return response(403, { error: 'This account is no longer available.' });
    }
  } catch {
    return response(503, { error: 'Account status could not be verified.' });
  }

  try {
    // Original treats malformed JSON as an empty body. Keep that contract while
    // bounding actual streamed bytes, independently of Content-Length.
    let body;
    try { body = await readJsonBody(request, 4096); }
    catch (error) {
      if (!(error instanceof BodyError)) throw error;
      if (error.status !== 400) return response(error.status, { error: error.message });
      body = {};
    }
    const city = typeof body?.city === 'string' ? body.city.trim() : '';
    if (!city || city.length > 200) return response(400, { error: 'A city name is required' });

    const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=' + encodeURIComponent(city);
    const upstream = await boundedFetch(url, {
      headers: { 'User-Agent': 'InterplanetaryFund/1.0 (geocoding)' },
    });
    if (!upstream.ok) return response(502, { error: 'Geocoding service unavailable' });
    const data = await upstream.json();
    if (!Array.isArray(data) || data.length === 0) return response(404, { error: 'Location not found' });
    const hit = data[0];
    const lat = parseFloat(hit.lat), lng = parseFloat(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return response(502, { error: 'Geocoding service unavailable' });
    }
    return response(200, { lat, lng, display: hit.display_name });
  } catch {
    return response(500, { error: 'Unable to geocode this location right now' });
  }
}
