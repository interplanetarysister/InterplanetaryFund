import test from 'node:test';
import assert from 'node:assert/strict';
import pages from '../server/worker.js';
import { routeReadRequest } from '../../../worker/reads.js';

test('Pages API handles health itself and never serves HTML for an unknown API', async () => {
  const env = { ASSETS: { fetch() { throw Error('API must not fall back to an HTML page'); } } };
  const health = await pages.fetch(new Request('https://preview.example/api/health'), env);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).service, 'ifund-migration-api');
  const unknown = await pages.fetch(new Request('https://preview.example/api/payments/not-implemented'), env);
  assert.equal(unknown.status, 404);
});
test('non-API routes delegate to the real Pages asset binding', async () => {
  let path;
  const response = await pages.fetch(new Request('https://preview.example/discover'), {
    ASSETS: { fetch(request) { path = new URL(request.url).pathname; return new Response('asset'); } },
  });
  assert.equal(path, '/discover'); assert.equal(await response.text(), 'asset');
});
test('public community projection does not require private author identity grants', async () => {
  let requested;
  const r = await routeReadRequest(new Request('https://preview.example/api/community/feed'), {
    MIGRATION_API_PREVIEW:'enabled', SUPABASE_URL:'https://ssibsfmtodgximseeqsv.supabase.co',
    SUPABASE_PUBLISHABLE_KEY:'test-publishable-key',
  }, async (url, options) => {
    requested = new URL(url);
    assert.equal(options.headers.Authorization, undefined);
    return Response.json([]);
  });
  assert.equal(r.status, 200);
  assert.equal(requested.searchParams.get('select'), 'id,body,created_at');
});

test('public configuration exposes only a canonical publishable key', async () => {
  for (const key of ['sb_secret_private','eyJ.service_role.jwt','']) {
    const r = await pages.fetch(new Request('https://preview.example/api/public-config'), {
      SUPABASE_URL:'https://ssibsfmtodgximseeqsv.supabase.co', SUPABASE_PUBLISHABLE_KEY:key,
    });
    assert.equal(r.status,503);
    assert.doesNotMatch(await r.text(),/sb_secret_private|eyJ/);
  }
  const r = await pages.fetch(new Request('https://preview.example/api/public-config'), {
    SUPABASE_URL:'https://ssibsfmtodgximseeqsv.supabase.co', SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',
  });
  assert.deepEqual(await r.json(),{url:'https://ssibsfmtodgximseeqsv.supabase.co',key:'sb_publishable_test'});
});
