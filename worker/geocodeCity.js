import { response } from './reads.js';
import { readJsonBody, BodyError } from './bodyLimit.js';
import { normalizeCityQuery, verifiedCityLocation } from '../apps/web/src/lib/cityGeocodeContract.mjs';

const SUPABASE_URL = 'https://ssibsfmtodgximseeqsv.supabase.co';
const PROVIDER_URL = 'https://nominatim.openstreetmap.org/search';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CITY_TYPES = new Set(['city', 'town', 'village', 'municipality', 'hamlet', 'borough']);
const CACHE_SECONDS = 604800;
const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
  new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');

async function boundedJson(upstream, limit = 65536) {
  if (!upstream.ok) throw new Error('Upstream unavailable.');
  const headers = new Headers(upstream.headers);
  headers.set('content-type', 'application/json');
  try {
    return await readJsonBody(new Request('https://ifund.invalid/bounded-response', {
      method: 'POST', headers, body: upstream.body, duplex: 'half',
    }), limit);
  } catch { throw new Error('Unverified upstream response.'); }
}

function serverHeaders(key) {
  const headers = { apikey: key, 'content-type': 'application/json', Accept: 'application/json' };
  if (!key.startsWith('sb_secret_')) headers.Authorization = 'Bearer ' + key;
  return headers;
}

async function consumeQuota(env, key, bucket, limit, seconds, fetcher) {
  const result = await fetcher(SUPABASE_URL + '/rest/v1/rpc/ifund_device_rate_limit', {
    method: 'POST', headers: serverHeaders(key),
    body: JSON.stringify({ p_bucket_hash: await hash(bucket), p_limit: limit, p_window_seconds: seconds }),
  });
  const allowed = await boundedJson(result, 64);
  if (typeof allowed !== 'boolean') throw new Error('Rate limit receipt unavailable.');
  return allowed;
}

/** City-centre lookup only. Default disabled; no legacy platform or campaign writes. */
export async function routeGeocodeCity(request, env = {}, fetcher = fetch, cache = globalThis.caches?.default) {
  if (new URL(request.url).pathname !== '/api/geocode/city') return response(404, { error: 'Not found.' });
  if (request.method !== 'POST') return response(405, { error: 'Method not allowed.' });
  const serverKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (env.IFUND_GEOCODE_ENABLED !== 'enabled' || env.SUPABASE_URL !== SUPABASE_URL ||
      typeof env.SUPABASE_PUBLISHABLE_KEY !== 'string' || !env.SUPABASE_PUBLISHABLE_KEY ||
      typeof serverKey !== 'string' || serverKey.length < 20)
    return response(503, { error: 'City search is temporarily unavailable. Choose a broad city preset instead.' });
  const boundedFetch = (url, init = {}) => fetcher(url, {
    ...init, redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  try {
    const body = await readJsonBody(request, 1024);
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).length !== 1 || !Object.hasOwn(body, 'city'))
      return response(400, { error: 'Send one city name only.' });
    let city;
    try { city = normalizeCityQuery(body.city); }
    catch { return response(400, { error: 'Enter a city and optional region, without an address or postal code.' }); }

    const bearer = request.headers.get('authorization') || '';
    if (!/^Bearer [A-Za-z0-9._~-]{16,8192}$/.test(bearer)) return response(401, { error: 'Sign in to look up a city.' });
    const memberHeaders = { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: bearer, Accept: 'application/json' };
    const identityResponse = await boundedFetch(SUPABASE_URL + '/auth/v1/user', { headers: memberHeaders });
    if (!identityResponse.ok) return response(401, { error: 'Sign in to look up a city.' });
    const user = await boundedJson(identityResponse);
    if (!UUID.test(user?.id || '') || user.is_anonymous === true || !user.email_confirmed_at)
      return response(401, { error: 'Confirm your email account before looking up a city.' });
    const profileQuery = new URLSearchParams({
      select: 'id,account_status,account_deletion_pending', id: 'eq.' + user.id, limit: '2',
    });
    const profiles = await boundedJson(await boundedFetch(SUPABASE_URL + '/rest/v1/ifund_profiles?' + profileQuery,
      { headers: memberHeaders }));
    if (!Array.isArray(profiles) || profiles.length !== 1 || profiles[0]?.id !== user.id ||
        profiles[0].account_status !== 'active' || profiles[0].account_deletion_pending !== false)
      return response(403, { error: 'Your account is not eligible for city lookup.' });

    // Reuse the existing atomic, service-role-only rate bucket RPC. The caller
    // never controls keys/limits. No application records or new schema are added.
    if (!await consumeQuota(env, serverKey, 'ifund-geocode-owner:' + user.id, 10, 60, boundedFetch))
      return response(429, { error: 'City search limit reached. Try again in a minute.' });
    const cacheKey = new Request('https://interplanetaryfund.com/__city-cache/' + await hash(city.toLocaleLowerCase('en-US')));
    if (cache) {
      try {
        const hit = await cache.match(cacheKey);
        if (hit) return response(200, verifiedCityLocation(await boundedJson(hit, 2048)));
      } catch { /* A cache miss or invalid entry never becomes a false result. */ }
    }
    // One global grant per TWO seconds across all users/regions. A per-isolate
    // timer or per-location Cloudflare counter cannot enforce Nominatim's
    // application-wide maximum of one uncached provider request per second.
    if (!await consumeQuota(env, serverKey, 'ifund-geocode-nominatim-global', 1, 2, boundedFetch))
      return response(429, { error: 'City search is busy. Wait a moment and try again.' });
    const url = new URL(PROVIDER_URL);
    url.search = new URLSearchParams({ q: city, format: 'jsonv2', limit: '1', featureType: 'city' }).toString();
    const result = await boundedFetch(url.href, { headers: {
      'User-Agent': 'InterplanetaryFund/1.0 (+https://interplanetaryfund.com/contact)',
      Accept: 'application/json',
    } });
    if (!result.ok) return response(502, { error: 'City search provider is unavailable. Try later.' });
    const hits = await boundedJson(result);
    if (!Array.isArray(hits)) throw new Error('Invalid city response.');
    if (!hits.length) return response(404, { error: 'City not found. Add a region or country and try again.' });
    const hit = hits[0];
    const lat = typeof hit.lat === 'string' && /^-?\d+(?:\.\d+)?$/.test(hit.lat) ? Number(hit.lat) : NaN;
    const lng = typeof hit.lon === 'string' && /^-?\d+(?:\.\d+)?$/.test(hit.lon) ? Number(hit.lon) : NaN;
    if (!CITY_TYPES.has(hit.addresstype) || !Number.isFinite(lat) || Math.abs(lat) > 90 ||
        !Number.isFinite(lng) || Math.abs(lng) > 180)
      return response(502, { error: 'A broad city location could not be verified.' });
    const location = verifiedCityLocation({ lat: Math.round(lat * 10) / 10, lng: Math.round(lng * 10) / 10,
      display: hit.name || String(hit.display_name || '').split(',')[0], approximate: true,
      provider: 'openstreetmap_nominatim', attribution: '© OpenStreetMap contributors' });
    if (cache) {
      try { await cache.put(cacheKey, Response.json(location, { headers: { 'cache-control': 'public, max-age=' + CACHE_SECONDS } })); }
      catch { /* Cache failure does not erase a validated provider result. */ }
    }
    return response(200, location);
  } catch (cause) {
    if (cause instanceof BodyError && cause.status !== 500)
      return response(cause.status, { error: cause.message });
    return response(503, { error: 'City search could not be verified. Choose a broad city preset or try later.' });
  }
}
