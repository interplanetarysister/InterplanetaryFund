import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import { routeCampaignWrite } from '../worker/campaignWrites.js';
import { routeReadRequest } from '../worker/reads.js';

const uid = 'a09c3b82-1758-454d-912c-e69ea4136daa';
const other = '9baa21da-845b-46d9-9476-a41c38564756';
const campaignId = 'b7486a53-40a8-4a71-8377-141332ab4341';
const env = {
  MIGRATION_API_PREVIEW: 'enabled',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-test-only',
};
const origin = 'https://api.example.org';
const headers = { authorization: 'Bearer signed.test.jwt', 'content-type': 'application/json' };
const valid = {
  title: 'Beach cleanup', summary: 'Community cleanup',
  story: 'Remove trash safely', category: 'community',
  goal_amount: 500, status: 'active',
};
function request(data, path = '/api/campaigns', method = 'POST', h = headers) {
  return new Request(origin + path, { method, headers: h, body: JSON.stringify(data) });
}
function remote(calls, { owner = uid, rows = null } = {}) {
  return async (target, opts) => {
    calls.push({ url: String(target), opts });
    if (String(target).endsWith('/auth/v1/user')) return Response.json({ id: uid });
    return Response.json(rows ?? [{
      id: campaignId, owner_id: owner,
      status: JSON.parse(opts.body).status || 'draft',
      updated_at: '2026-10-25T00:00:00Z',
    }]);
  };
}
test('health responds without configuration, unsupported API paths do not proxy', async () => {
  assert.equal((await worker.fetch(new Request(origin + '/api/health'))).status, 200);
  assert.equal((await worker.fetch(new Request(origin + '/api/mcp/example'))).status, 404);
  assert.equal((await worker.fetch(new Request(origin + '/api/paypal/webhook'))).status, 404);
});
test('all mounted migration API routes are off without the preview gate', async () => {
  for (const pathname of [
    '/api/campaigns/public', '/api/campaigns/mine', '/api/community/feed',
    '/api/campaigns/' + campaignId, '/api/campaigns/' + campaignId + '/draft',
  ]) {
    assert.equal((await worker.fetch(new Request(origin + pathname))).status, 503);
  }
  assert.equal((await worker.fetch(request(valid))).status, 503);
});
test('anonymous write denied before contacting Supabase', async () => {
  const r = await routeCampaignWrite(request(valid, '/api/campaigns', 'POST',
    { 'content-type': 'application/json' }), env,
    () => { throw Error('must not contact provider'); });
  assert.equal(r.status, 401);
});
test('new draft uses JWT authentication, publishable key and derived owner only', async () => {
  const calls = [];
  const r = await routeCampaignWrite(request({ title: 'New draft' }), env, remote(calls));
  assert.equal(r.status, 201);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].opts.method, 'POST');
  assert.equal(calls[1].opts.headers.Authorization, 'Bearer signed.test.jwt');
  assert.equal(calls[1].opts.headers.apikey, env.SUPABASE_PUBLISHABLE_KEY);
  assert.equal(calls[1].opts.headers.Prefer, 'return=representation');
  assert.equal(JSON.parse(calls[1].opts.body).owner_id, uid);
  assert.equal(JSON.parse(calls[1].opts.body).status, 'draft');
  assert.deepEqual(await r.json(), {
    id: campaignId, status: 'draft', updated_at: '2026-10-25T00:00:00Z',
  });
});
test('publish validates complete content, while valid publish succeeds', async () => {
  const calls = [];
  const missing = await routeCampaignWrite(request({
    status: 'active', title: 'Incomplete', goal_amount: 5,
  }), env, remote(calls));
  assert.equal(missing.status, 422);
  assert.equal(calls.length, 1);
  const good = await routeCampaignWrite(request(valid), env, remote([]));
  assert.equal(good.status, 201);
});
test('writes reject owner override, financial fields, unsafe links and invalid money', async () => {
  const invalid = [
    { ...valid, owner_id: other }, { ...valid, raised_amount: 400 },
    { ...valid, donation_total: 100 }, { ...valid, role: 'super_admin' },
    { ...valid, goal_amount: -1 }, { ...valid, goal_amount: '1.234' },
    { ...valid, goal_amount: '1e9' }, { ...valid, status: 'paid' },
    { ...valid, cover_image_url: 'javascript:alert(1)' },
    { ...valid, cover_image_url: 'https://a:b@example.org/' },
  ];
  for (const data of invalid) {
    const calls = [];
    assert.equal((await routeCampaignWrite(request(data), env, remote(calls))).status, 422);
    assert.equal(calls.length, 1);
  }
});
test('PATCH must include both exact campaign id and signed-in owner filter', async () => {
  const calls = [];
  const r = await routeCampaignWrite(request({
    title: 'Updated',
  }, '/api/campaigns/' + campaignId, 'PATCH'), env, remote(calls));
  assert.equal(r.status, 200);
  assert.equal(calls[1].opts.method, 'PATCH');
  assert.match(calls[1].url, /owner_id=eq/);
  assert.ok(calls[1].url.includes(uid));
  assert.ok(calls[1].url.includes(campaignId));
  assert.equal(JSON.parse(calls[1].opts.body).owner_id, undefined);
});
test('missing or wrong-owner rows fail closed; internal errors stay private', async () => {
  const path = '/api/campaigns/' + campaignId;
  assert.equal((await routeCampaignWrite(request({ title: 'Change' }, path, 'PATCH'),
    env, remote([], { rows: [] }))).status, 404);
  assert.equal((await routeCampaignWrite(request(valid),
    env, remote([], { owner: other }))).status, 503);
  const r = await routeCampaignWrite(request(valid), env, async (target) =>
    String(target).endsWith('/auth/v1/user') ? Response.json({ id: uid }) :
      new Response('sensitive-provider-error', { status: 500 }));
  assert.equal(r.status, 503);
  assert.doesNotMatch(await r.text(), /sensitive-provider-error/);
});
test('rejects unknown IDs, unsupported methods, content types and oversized data', async () => {
  assert.equal((await routeCampaignWrite(request({ title: 'x' },
    '/api/campaigns/not-uuid', 'PATCH'), env)).status, 400);
  assert.equal((await routeCampaignWrite(new Request(origin + '/api/campaigns',
    { method: 'DELETE' }), env)).status, 405);
  assert.equal((await routeCampaignWrite(new Request(origin + '/api/campaigns',
    { method: 'POST', body: '{}' }), env)).status, 415);
  const calls = [];
  assert.equal((await routeCampaignWrite(request({
    story: 'a'.repeat(35_000),
  }), env, remote(calls))).status, 413);
  assert.equal(calls.length, 1); // Verified auth, but never issued a content write.
});
test('mine route requires verified JWT and adds owner-scoped read limit', async () => {
  const anon = await routeReadRequest(new Request(origin + '/api/campaigns/mine'),
    env, () => { throw Error('no fetch'); });
  assert.equal(anon.status, 401);
  const calls = [];
  const r = await routeReadRequest(new Request(origin + '/api/campaigns/mine',
    { headers }), env, async (target, opts) => {
    calls.push({ url: String(target), opts });
    return String(target).endsWith('/auth/v1/user') ?
      Response.json({ id: uid }) : Response.json([{ id: campaignId }]);
  });
  assert.equal(r.status, 200);
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /owner_id=eq/);
  assert.ok(calls[1].url.includes(uid));
  assert.match(calls[1].url, /limit=50/);
  assert.equal(calls[1].opts.headers.Authorization, 'Bearer signed.test.jwt');
});
test('public detail route only requests active campaigns with selected fields', async () => {
  const calls = [];
  const r = await routeReadRequest(new Request(origin + '/api/campaigns/' + campaignId),
    env, async (target) => {
      calls.push(String(target));
      return Response.json([{ id: campaignId }]);
    });
  assert.equal(r.status, 200);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /status=eq.active/);
  assert.ok(calls[0].includes(campaignId));
  assert.ok(!calls[0].includes('donation'));
  const bad = await routeReadRequest(new Request(origin + '/api/campaigns/abc'),
    env, () => { throw Error('no fetch'); });
  assert.equal(bad.status, 400);
});
