import test from 'node:test';
import assert from 'node:assert/strict';
import { routeGeocodeCity } from '../worker/geocodeCity.js';

const uid = '11111111-1111-4111-8111-111111111111';
const token = 'test.member.access.token';
const env = { IFUND_GEOCODE_ENABLED: 'enabled', SUPABASE_URL: 'https://ssibsfmtodgximseeqsv.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key', SUPABASE_SECRET_KEY: 'sb_secret_server_only_test_key' };
const location = { lat: '51.5074456', lon: '-0.1277653', name: 'London', addresstype: 'city' };
function request(body = { city: 'London' }, overrides = {}) {
  return new Request('https://interplanetaryfund.com/api/geocode/city', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify(body), ...overrides,
  });
}
function fixture(options = {}) {
  const calls = [];
  const fetcher = async (address, init = {}) => {
    const url = new URL(address); calls.push({ url, init });
    if (url.hostname === 'ssibsfmtodgximseeqsv.supabase.co') {
      if (url.pathname === '/auth/v1/user') return Response.json(options.user ||
        { id: uid, email_confirmed_at: '2026-11-16', is_anonymous: false }, { status: options.authStatus || 200 });
      if (url.pathname === '/rest/v1/ifund_profiles') return Response.json(options.profiles ||
        [{ id: uid, account_status: 'active', account_deletion_pending: false }]);
      if (url.pathname === '/rest/v1/rpc/ifund_device_rate_limit') {
        const input = JSON.parse(init.body);
        if (options.quotaThrows) throw new Error('secret database diagnostic');
        const allowed = options.quota ? options.quota(input) : true;
        return Response.json(allowed);
      }
    }
    assert.equal(url.origin, 'https://nominatim.openstreetmap.org');
    assert.equal(url.pathname, '/search');
    if (options.providerThrows) throw new Error('private provider diagnostic');
    if (options.providerRaw) return new Response(options.providerRaw);
    return Response.json(options.hits || [location], { status: options.providerStatus || 200 });
  };
  return { calls, fetcher, providerCalls: () => calls.filter(call => call.url.hostname === 'nominatim.openstreetmap.org') };
}

test('authenticated city lookup rounds a verified city centre without writing campaign records', async () => {
  const f = fixture();
  const result = await routeGeocodeCity(request(), env, f.fetcher, null);
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { lat: 51.5, lng: -0.1, display: 'London', approximate: true,
    provider: 'openstreetmap_nominatim', attribution: '© OpenStreetMap contributors' });
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal(f.calls.length, 5);
  assert.ok(f.calls.every(c => c.init.redirect === 'error' && c.init.signal));
  assert.equal(f.calls[1].url.searchParams.get('id'), 'eq.' + uid);
  assert.equal(f.calls[1].url.searchParams.get('select'), 'id,account_status,account_deletion_pending');
});

test('provider receives a fixed city-only query, identifying user agent and no member/server credentials', async () => {
  const f = fixture({ hits: [{ ...location, name: 'São Paulo' }] });
  await routeGeocodeCity(request({ city: 'São Paulo, Brasil' }), env, f.fetcher, null);
  const { url, init } = f.providerCalls()[0];
  assert.equal(url.searchParams.get('q'), 'São Paulo, Brasil');
  assert.equal(url.searchParams.get('featureType'), 'city');
  assert.equal(url.searchParams.get('limit'), '1');
  assert.equal(init.headers.Authorization, undefined);
  assert.equal(init.headers.apikey, undefined);
  assert.match(init.headers['User-Agent'], /InterplanetaryFund.*https:\/\/interplanetaryfund.com\/contact/);
  for (const call of f.calls.slice(2, 4)) {
    assert.equal(call.init.headers.apikey, env.SUPABASE_SECRET_KEY);
    assert.equal(call.init.headers.Authorization, undefined, 'opaque secret API keys are not bearer JWTs');
    assert.match(JSON.parse(call.init.body).p_bucket_hash, /^[0-9a-f]{64}$/);
  }
});

test('disabled or wrong-project configuration never sends credentials or reaches the provider', async () => {
  for (const patch of [{ IFUND_GEOCODE_ENABLED: undefined }, { SUPABASE_SECRET_KEY: undefined },
    { SUPABASE_URL: env.SUPABASE_URL + '/extra' }, { SUPABASE_URL: 'https://attacker.invalid' }]) {
    const result = await routeGeocodeCity(request(), { ...env, ...patch }, () => { throw new Error('Must not fetch'); }, null);
    assert.equal(result.status, 503);
  }
});

test('wrong method and unrelated route cannot invoke lookup', async () => {
  assert.equal((await routeGeocodeCity(new Request('https://ifund.test/api/geocode/city'), env)).status, 405);
  assert.equal((await routeGeocodeCity(new Request('https://ifund.test/api/geocode/other'), env)).status, 404);
});

test('addresses, postal codes, GPS, URLs, controls and caller-controlled rate/provider fields are rejected before auth', async () => {
  for (const body of [{ city: '123 Main Street' }, { city: 'Seattle 98101' }, { city: '47.6,-122.3' },
    { city: 'https://evil.example' }, { city: 'London', url: 'https://evil.example' },
    { city: 'London', p_limit: 1000 }, { city: 'A'.repeat(81) }, { city: 'London\nParis' }, { city: [] }, [], null]) {
    const f = fixture();
    assert.equal((await routeGeocodeCity(request(body), env, f.fetcher, null)).status, 400, JSON.stringify(body));
    assert.equal(f.calls.length, 0);
  }
});

test('malformed and streamed oversized JSON cannot reach auth or provider', async () => {
  for (const [raw, status] of [['{', 400], [JSON.stringify({ city: 'x'.repeat(2000) }), 413]]) {
    const f = fixture();
    assert.equal((await routeGeocodeCity(request({}, { body: raw }), env, f.fetcher, null)).status, status);
    assert.equal(f.calls.length, 0);
  }
});

test('anonymous, unconfirmed, unauthenticated and inactive accounts cannot call the geocoder', async () => {
  const cases = [{ user: { id: uid, is_anonymous: true } }, { user: { id: uid } },
    { authStatus: 401 }, { profiles: [] }, { profiles: [{ id: 'other', account_status: 'active', account_deletion_pending: false }] },
    { profiles: [{ id: uid, account_status: 'suspended', account_deletion_pending: false }] },
    { profiles: [{ id: uid, account_status: 'active', account_deletion_pending: true }] }];
  for (const options of cases) {
    const f = fixture(options), result = await routeGeocodeCity(request(), env, f.fetcher, null);
    assert.ok([401, 403].includes(result.status));
    assert.equal(f.providerCalls().length, 0);
    assert.ok(f.calls.length <= 2, 'no quota write for an unverified account');
  }
  const f = fixture();
  assert.equal((await routeGeocodeCity(request({}, { headers: { 'content-type': 'application/json' } }), env, f.fetcher, null)).status, 400);
  assert.equal((await routeGeocodeCity(request({ city: 'London' }, { headers: { 'content-type': 'application/json' } }), env, f.fetcher, null)).status, 401);
  assert.equal(f.calls.length, 0);
});

test('verified per-owner and global rate failures fail closed before provider access', async () => {
  for (const quota of [() => false, input => input.p_limit !== 1, () => ({ allowed: true })]) {
    const f = fixture({ quota }), result = await routeGeocodeCity(request(), env, f.fetcher, null);
    assert.ok([429, 503].includes(result.status));
    assert.equal(f.providerCalls().length, 0);
  }
});

test('concurrent uncached requests share one global atomic provider budget', async () => {
  let globalGrants = 0;
  const f = fixture({ quota: input => input.p_limit !== 1 || ++globalGrants === 1 });
  const results = await Promise.all([routeGeocodeCity(request(), env, f.fetcher, null), routeGeocodeCity(request(), env, f.fetcher, null)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 429]);
  assert.equal(f.providerCalls().length, 1);
  const global = f.calls.filter(c => c.url.pathname.endsWith('ifund_device_rate_limit'))
    .map(c => JSON.parse(c.init.body)).filter(input => input.p_limit === 1);
  assert.ok(global.every(input => input.p_window_seconds === 2));
  assert.equal(new Set(global.map(input => input.p_bucket_hash)).size, 1);
});

test('cache stores only broad public city facts and avoids repeat provider calls after fresh auth', async () => {
  const entries = new Map();
  const cache = { match: async key => entries.get(key.url)?.clone(), put: async (key, value) => entries.set(key.url, value.clone()) };
  const f = fixture();
  assert.equal((await routeGeocodeCity(request(), env, f.fetcher, cache)).status, 200);
  assert.equal((await routeGeocodeCity(request(), env, f.fetcher, cache)).status, 200);
  assert.equal(f.providerCalls().length, 1);
  assert.equal(f.calls.filter(c => c.url.pathname === '/auth/v1/user').length, 2);
  for (const [key, stored] of entries) {
    assert.doesNotMatch(key, /London|11111111|test.member/);
    const text = await stored.text();
    assert.doesNotMatch(text, /11111111|test.member|sb_secret/);
  }
});

test('empty results, non-city features, malformed coordinates and provider failures never fabricate success', async () => {
  for (const [options, status] of [[{ hits: [] }, 404], [{ hits: [{ ...location, addresstype: 'house' }] }, 502],
    [{ hits: [{ ...location, lat: '51.5junk' }] }, 502], [{ hits: [{ ...location, lon: '181' }] }, 502],
    [{ providerStatus: 429 }, 502], [{ providerThrows: true }, 503], [{ providerRaw: 'x'.repeat(70000) }, 503]]) {
    const f = fixture(options), result = await routeGeocodeCity(request(), env, f.fetcher, null);
    assert.equal(result.status, status);
    assert.doesNotMatch(await result.text(), /private provider|secret database|sb_secret/);
  }
});
