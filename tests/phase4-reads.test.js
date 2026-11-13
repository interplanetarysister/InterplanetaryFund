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
  const req = new Request(`https://api.example.org/api/campaigns/${id}/draft`, {
    headers: { authorization: 'Bearer signed.test.jwt' },
  });
  const r = await routeReadRequest(req, env, async (url, opts) => {
    calls.push({ url, headers: opts.headers });
    return url.endsWith('/auth/v1/user') ? Response.json({ id: userId }) : Response.json([{ id }]);
  });
  assert.equal(r.status, 200);
  assert.equal(calls.length, 2);
  assert.ok(calls[1].url.includes('owner_id=eq.'));
  assert.ok(calls[1].url.includes(userId));
  assert.equal(calls[1].headers.Authorization, 'Bearer signed.test.jwt');
});
test('invalid campaign IDs reject without touching Supabase', async () => {
  const req = new Request('https://api.example.org/api/campaigns/123/draft');
  const r = await routeReadRequest(req, env, () => { throw Error('no request expected'); });
  assert.equal(r.status, 400);
});
test('upstream errors do not surface provider secrets or internal response bodies', async () => {
  const req = new Request('https://api.example.org/api/community/feed');
  const r = await routeReadRequest(req, env, async () => new Response('secret-provider-diagnostic', { status: 500 }));
  assert.equal(r.status, 503);
  assert.doesNotMatch(await r.text(), /secret-provider-diagnostic/);
});


test('community feed uses moderated public RPC and never requests raw author IDs', async () => {
  const calls = [];
  const response = await routeReadRequest(
    new Request('https://api.example.org/api/community/feed'), env,
    async (url, options) => {
      calls.push({ url: String(url), options });
      return Response.json([{ id: 'post-123', body: 'Public update', profile_id: null }]);
    },
  );
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /rpc\/ifund_public_social_feed$/);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.equal(JSON.parse(calls[0].options.body).p_author, null);
  assert.deepEqual(await response.json(), [{ id: 'post-123', body: 'Public update', profile_id: null }]);
});
