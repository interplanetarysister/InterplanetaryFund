import test from 'node:test';
import assert from 'node:assert/strict';
import { routeReadRequest } from '../worker/reads.js';

const env = {
  MIGRATION_API_PREVIEW: 'enabled',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-test-only',
};
const id = 'b7486a53-40a8-4a71-8377-141332ab4341';
const userId = 'a09c3b82-1758-454d-912c-e69ea4136daa';

test('no migration endpoints are enabled without explicit preview gate', async () => {
  const r = await routeReadRequest(new Request('https://api.example.org/api/community/feed'),
    { ...env, MIGRATION_API_PREVIEW: undefined },
    () => { throw Error('must never access remote'); });
  assert.equal(r.status, 503);
});
test('public campaign read filters for active records with bounded fields', async () => {
  const paths = [];
  const r = await routeReadRequest(new Request('https://api.example.org/api/campaigns/public'),
    env, async (url) => { paths.push(url); return Response.json([{ id }]); });
  assert.equal(r.status, 200);
  assert.ok(paths[0].includes('status=eq.active'));
  assert.ok(paths[0].includes('limit=30'));
  assert.deepEqual(await r.json(), [{ id }]);
});
test('private draft cannot be retrieved without a validated Supabase JWT', async () => {
  const r = await routeReadRequest(new Request(`https://api.example.org/api/campaigns/${id}/draft`),
    env, () => { throw Error('should never fetch'); });
  assert.equal(r.status, 401);
});
test('private draft requires remote Auth verification and RLS-scoped bearer', async () => {
  const calls = [];
  const req = new Request('https://api.example.org/api/campaigns/' + id + '/draft', {
    headers: { authorization: 'Bearer signed.test.jwt' },
  });
  const r = await routeReadRequest(req, env, async (url, opts) => {
    calls.push({ url, headers: opts.headers });
    return url.endsWith('/auth/v1/user') ? Response.json({ id: userId, email_confirmed_at: '2026-10-01T00:00:00.000Z' }) : Response.json([{ id }]);
  });
  assert.equal(r.status, 200);
  assert.equal(calls.length, 2);
  assert.ok(calls[1].url.includes('owner_id=eq.'));
  assert.ok(calls[1].url.includes(userId));
  assert.equal(calls[1].headers.Authorization, 'Bearer signed.test.jwt');
});
test('invalid campaign IDs reject without touching Supabase', async () => {
  const req = new Request('https://api.example.org/api/campaigns/' + id + '/draft', {
  const r = await routeReadRequest(req, env, () => { throw Error('no request expected'); });
  assert.equal(r.status, 400);
});
test('upstream errors do not surface provider secrets or internal response bodies', async () => {
  const req = new Request('https://api.example.org/api/community/feed');
  const r = await routeReadRequest(req, env, async () => new Response('secret-provider-diagnostic', { status: 500 }));
  assert.equal(r.status, 503);
  assert.doesNotMatch(await r.text(), /secret-provider-diagnostic/);
});


test('unconfirmed email sessions cannot read private migration data', async () => {
  const calls = [];
  const req = new Request('https://api.example.org/api/campaigns/' + id + '/draft', {
    headers: { authorization: 'Bearer signed.test.jwt' },
  });
  const r = await routeReadRequest(req, env, async (url) => {
    calls.push(String(url));
    return url.endsWith('/auth/v1/user')
      ? Response.json({ id: userId, email_confirmed_at: null })
      : Response.json([{ id }]);
  });
  assert.equal(r.status, 401);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].endsWith('/auth/v1/user'));
});
