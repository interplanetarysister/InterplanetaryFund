import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { geocodeCity } from '../worker/geocodeCity.js';
import worker from '../worker/index.js';
import isolatedWorker from '../worker/geocodeWorker.js';

const uid = '11111111-1111-4111-8111-111111111111';
const env = {
  MIGRATION_API_PREVIEW: 'enabled', IFUND_GEOCODE_ENABLED: 'enabled',
  SUPABASE_URL: 'https://ssibsfmtodgximseeqsv.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-test-only',
};
const fixtures = name => readFileSync(new URL('./fixtures/geocode/' + name, import.meta.url), 'utf8');
const hit = { lat: '51.5074456', lon: '-0.1277653', display_name: 'London, England, United Kingdom' };
function request(raw = JSON.stringify({ city: ' London ' }), token = 'signed.test.jwt') {
  return new Request('https://example.org/functions/geocodeCity', { method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: raw });
}
const snapshot = async r => ({ status: r.status, body: await r.json() });
function dependencies({ profile = { id: uid, account_status: 'active', account_deletion_pending: false }, user = { id: uid }, hits = [hit], providerStatus = 200, providerThrows = false, profileStatus = 200 } = {}) {
  const calls = [];
  const fetcher = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const u = new URL(url);
    if (u.hostname === 'ssibsfmtodgximseeqsv.supabase.co') {
      if (u.pathname === '/auth/v1/user') return Response.json(user || {}, { status: user ? 200 : 401 });
      if (u.pathname === '/rest/v1/ifund_profiles') return Response.json(profile ? [profile] : [], { status: profileStatus });
    }
    if (u.hostname === 'nominatim.openstreetmap.org') {
      if (providerThrows) throw Error('private upstream diagnostic');
      return Response.json(hits, { status: providerStatus });
    }
    throw Error('Unexpected network destination: ' + url);
  };
  const base44 = { auth: { me: async () => user }, asServiceRole: { entities: { User: { get: async () => profile } } } };
  // Execute the pinned original, including its real account guard. Only external
  // collaborators are simulated; no source handler logic is rewritten for parity.
  const guard = fixtures('accountGuard.ts.txt').replaceAll('export async function', 'async function');
  const source = fixtures('entry.ts.txt').replace(/^import .*;\r?\n/gm, '').replace('export default async function', 'async function original');
  const context = vm.createContext({ Response, fetch: fetcher, createClientFromRequest: () => base44, console: { error() {} } });
  vm.runInContext(guard + '\n' + source + '\nthis.original = original;', context);
  return { fetcher, calls, original: context.original };
}

test('reference fixtures are exact pinned source bytes', () => {
  for (const [name, hash] of [['entry.ts.txt','ec8eea5c494c09b9f1d267b053213045f234b23ff4d84ec9afc4a735da748f37'],['accountGuard.ts.txt','97e70628f9b15af3a1f508cdfa800f94da0c2f6ea2e60c91bcc27efd34d855c8']]) {
    assert.equal(createHash('sha256').update(fixtures(name)).digest('hex'), hash);
  }
});

for (const [name, raw, options] of [
  ['success', JSON.stringify({ city: ' London ' }), {}],
  ['UTF-8 and query escaping', JSON.stringify({ city: 'São Paulo & q=Rome' }), {}],
  ['maximum city length', JSON.stringify({ city: 'A'.repeat(200) }), {}],
  ['missing city', '{}', {}], ['malformed JSON', '{', {}],
  ['non-string city', '{"city":12}', {}], ['blank city', '{"city":"  "}', {}],
  ['overlong city', JSON.stringify({ city: 'A'.repeat(201) }), {}],
  ['no location', '{"city":"missing"}', { hits: [] }],
  ['provider failure', '{"city":"London"}', { providerStatus: 429 }],
  ['network failure', '{"city":"London"}', { providerThrows: true }],
  ['missing account', '{}', { user: null }],
  ['deleted profile', '{}', { profile: null }],
  ['disabled profile', '{}', { profile: { id: uid, account_status: 'disabled', account_deletion_pending: false } }],
  ['deletion pending', '{}', { profile: { id: uid, account_status: 'active', account_deletion_pending: true } }],
]) {
  test('matches original handler: ' + name, async () => {
    const d = dependencies(options);
    const expected = await snapshot(await d.original(request(raw)));
    const actual = await snapshot(await geocodeCity(request(raw), env, d.fetcher));
    assert.deepEqual(actual, expected);
    if (actual.status === 200) assert.deepEqual(actual.body, { lat: 51.5074456, lng: -0.1277653, display: hit.display_name });
  });
}

test('auth and profile use caller bearer; public provider receives no credentials', async () => {
  const d = dependencies();
  await geocodeCity(request(), env, d.fetcher);
  assert.equal(d.calls.length, 3);
  for (const call of d.calls.slice(0, 2)) {
    assert.equal(call.init.headers.Authorization, 'Bearer signed.test.jwt');
    assert.equal(call.init.headers.apikey, env.SUPABASE_PUBLISHABLE_KEY);
    assert.equal(call.init.redirect, 'error');
  }
  const profileUrl = new URL(d.calls[1].url);
  assert.equal(profileUrl.searchParams.get('id'), 'eq.' + uid);
  assert.equal(profileUrl.searchParams.get('select'), 'id,account_status,account_deletion_pending');
  const last = d.calls[2];
  assert.equal(last.init.headers.Authorization, undefined);
  assert.equal(last.init.headers.apikey, undefined);
  assert.equal(last.init.headers['User-Agent'], 'InterplanetaryFund/1.0 (geocoding)');
  assert.equal(new URL(last.url).searchParams.get('q'), 'London');
});

test('missing bearer and inactive accounts never call geocoder', async () => {
  for (const [token, profile] of [[null, undefined], ['signed.test.jwt', { id: uid, account_status: 'disabled', account_deletion_pending: false }], ['signed.test.jwt', { id: uid, account_status: null, account_deletion_pending: null }]]) {
    const d = dependencies({ profile });
    const r = await geocodeCity(request('{}', token), env, d.fetcher);
    assert.ok([401, 403].includes(r.status));
    assert.ok(d.calls.every(c => new URL(c.url).hostname.endsWith('.supabase.co')));
  }
});

test('invalid profile shape, wrong owner, and upstream faults fail closed', async () => {
  for (const options of [{ profile: { id: uid } }, { profile: { id: 'other' } }, { profileStatus: 500 }]) {
    const d = dependencies(options);
    const r = await geocodeCity(request(), env, d.fetcher);
    assert.ok([401, 503].includes(r.status));
    assert.ok(d.calls.every(c => new URL(c.url).hostname.endsWith('.supabase.co')));
    assert.doesNotMatch(await r.text(), /private upstream diagnostic/);
  }
});

test('gates and canonical project pin reject before sending credentials', async () => {
  for (const changed of [{ IFUND_GEOCODE_ENABLED: undefined }, { MIGRATION_API_PREVIEW: undefined }, { SUPABASE_URL: 'https://tzehxfikoslihnclhxuz.supabase.co' }, { SUPABASE_URL: 'https://ssibsfmtodgximseeqsv.supabase.co@attacker.invalid' }, { SUPABASE_URL: env.SUPABASE_URL + '/redirect' }]) {
    const r = await geocodeCity(request(), { ...env, ...changed }, () => { throw Error('Must not fetch'); });
    assert.equal(r.status, 503);
  }
});

test('bounded body and nonfinite provider coordinates reject without fabricated success', async () => {
  const d = dependencies();
  assert.equal((await geocodeCity(request(JSON.stringify({ city: 'London', extra: 'x'.repeat(5000) })), env, d.fetcher)).status, 413);
  assert.equal(d.calls.length, 2);
  const bad = dependencies({ hits: [{ lat: 'bogus', lon: '0', display_name: 'Broken' }] });
  assert.equal((await geocodeCity(request(), env, bad.fetcher)).status, 502);
});

test('Worker dispatch preserves both original function paths and disabled default', async () => {
  for (const path of ['/functions/geocodeCity', '/api/apps/6a67a778342a8fe05ee79cba/functions/geocodeCity']) {
    const r = await worker.fetch(new Request('https://example.org' + path, { method: 'POST', body: '{}' }), {});
    assert.equal(r.status, 503);
  }
  assert.equal((await worker.fetch(new Request('https://example.org/functions/geocodeCity'), env)).status, 405);
  assert.equal((await worker.fetch(new Request('https://example.org/functions/notImplemented', { method: 'POST' }), env)).status, 404);
});

test('isolated staging worker exposes no other migration API', async () => {
  for (const path of ['/api/campaigns/public', '/api/community/feed', '/__verify/geocode']) {
    const r = await isolatedWorker.fetch(new Request('https://staging.example' + path), env);
    assert.equal(r.status, 404);
  }
});

test('verifier refuses to expose secret or legacy bearer keys', async () => {
  for (const key of ['sb_secret_sensitive', 'eyJ.service_role.jwt', 'eyJ.anon.jwt', '', undefined]) {
    const r = await isolatedWorker.fetch(new Request('https://staging.example/__verify/config'), {
      ...env, IFUND_GEOCODE_VERIFIER: 'enabled', SUPABASE_PUBLISHABLE_KEY: key,
    });
    assert.equal(r.status, 503);
    assert.doesNotMatch(await r.text(), /sb_secret_sensitive|eyJ/);
  }
});

test('verifier serves a publishable key and pins its credential destination', async () => {
  const e = { ...env, IFUND_GEOCODE_VERIFIER: 'enabled', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-only' };
  const r = await isolatedWorker.fetch(new Request('https://staging.example/__verify/config'), e);
  assert.deepEqual(await r.json(), { url: env.SUPABASE_URL, key: e.SUPABASE_PUBLISHABLE_KEY });
  const page = await isolatedWorker.fetch(new Request('https://staging.example/__verify/geocode'), e);
  assert.match(page.headers.get('content-security-policy'), /connect-src 'self' https:\/\/ssibsfmtodgximseeqsv.supabase.co/);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.equal(page.headers.get('referrer-policy'), 'no-referrer');
});
