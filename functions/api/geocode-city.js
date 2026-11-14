// Cloudflare Pages Function: POST /api/geocode-city
// Base44 geocodeCity replacement. No service-role key; user JWT is verified by Supabase Auth.
// Configure SUPABASE_URL and SUPABASE_ANON_KEY as server-side Pages variables.
// Rate-limit this endpoint at the Cloudflare zone before production enablement.
export const onRequestPost = async ({ request, env }) => {
  const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return json({ error: 'Service unavailable' }, 503);
  const token = (request.headers.get('authorization') || '').match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token) return json({ error: 'Unauthorized' }, 401);
  const origin = new URL(env.SUPABASE_URL);
  if (origin.protocol !== 'https:') return json({ error: 'Service unavailable' }, 503);
  const userResponse = await fetch(new URL('/auth/v1/user', origin), {
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` }
  }).catch(() => null);
  if (!userResponse?.ok) return json({ error: 'Unauthorized' }, 401);
  const user = await userResponse.json().catch(() => null);
  if (!user?.id) return json({ error: 'Unauthorized' }, 401);
  // Fail closed for suspended/unverified or deletion-pending accounts.
  const profileUrl = new URL('/rest/v1/ifund_profiles', origin);
  profileUrl.searchParams.set('select', 'account_status,account_deletion_pending,lifecycle_provenance');
  profileUrl.searchParams.set('id', `eq.${user.id}`);
  const profileResponse = await fetch(profileUrl, {
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` }
  }).catch(() => null);
  if (!profileResponse?.ok) return json({ error: 'Account not verified' }, 403);
  const profiles = await profileResponse.json().catch(() => []);
  const profile = profiles[0];
  if (profile?.account_status !== 'active' || profile?.account_deletion_pending !== false || !profile?.lifecycle_provenance) {
    return json({ error: 'Account not active' }, 403);
  }
  if (Number(request.headers.get('content-length') || 0) > 2048) return json({ error: 'Request too large' }, 413);
  const body = await request.json().catch(() => null);
  const city = typeof body?.city === 'string' ? body.city.trim() : '';
  if (!city || city.length > 200) return json({ error: 'A city name is required' }, 400);
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', city);
  const response = await fetch(url, { headers: {
    'User-Agent': 'InterplanetaryFund/1.0 (geocoding; https://interplanetaryfund.com)',
    'Accept': 'application/json'
  } }).catch(() => null);
  if (!response?.ok) return json({ error: 'Geocoding service unavailable' }, 502);
  const results = await response.json().catch(() => []);
  if (!Array.isArray(results) || !results.length) return json({ error: 'Location not found' }, 404);
  const hit = results[0];
  const lat = Number(hit.lat), lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return json({ error: 'Invalid geocoding response' }, 502);
  return json({ lat, lng, display: String(hit.display_name || '') });
};
