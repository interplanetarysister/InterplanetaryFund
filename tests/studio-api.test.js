import test from 'node:test';
import assert from 'node:assert/strict';
import { routeStudioRequest, routePublicStudioPage } from '../worker/studioRoutes.js';

const uid = 'a09c3b82-1758-454d-912c-e69ea4136daa';
const env = { MIGRATION_API_PREVIEW: 'enabled', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only' };
function request(path, method = 'GET', body, auth = true) {
  return new Request('https://ifund.example' + path, {
    method,
    headers: { ...(auth ? { authorization: 'Bearer verified.test.jwt' } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function remote(role, rows = []) {
  const calls = [];
  const fetcher = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: uid, app_metadata: { role } });
    return Response.json(rows);
  };
  return { calls, fetcher };
}
const page = { slug: 'welcome-page', title: 'Welcome', content: { blocks: [
  { id: 'hero-1', type: 'hero', heading: 'Welcome', body: 'Hello' },
] }, status: 'draft' };

test('studio rejects anonymous requests before database access', async () => {
  const r = await routeStudioRequest(request('/api/studio/pages', 'GET', undefined, false), env);
  assert.equal(r.status, 401);
});
test('studio rejects ordinary members using server-verified app_metadata role', async () => {
  const api = remote('member');
  const r = await routeStudioRequest(request('/api/studio/pages'), env, api.fetcher);
  assert.equal(r.status, 403);
  assert.equal(api.calls.length, 1);
});
test('studio allows admin and reads page data through the member JWT', async () => {
  const row = { id: '2e5a4d65-4c8f-45d0-89d9-2f2b1bfe0c61', ...page, created_by: uid, updated_by: uid };
  const api = remote('admin', [row]);
  const r = await routeStudioRequest(request('/api/studio/pages'), env, api.fetcher);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), [row]);
  assert.match(api.calls[1].url, /ifund_studio_pages/);
  assert.equal(api.calls[1].options.headers.Authorization, 'Bearer verified.test.jwt');
});
test('studio allows super_admin', async () => {
  const api = remote('super_admin', []);
  const r = await routeStudioRequest(request('/api/studio/pages'), env, api.fetcher);
  assert.equal(r.status, 200);
});
test('studio rejects malformed blocks, script types, duplicate IDs and privileged fields', async () => {
  const attempts = [
    { ...page, role: 'super_admin' },
    { ...page, content: { blocks: [{ id: 'x', type: 'script', heading: 'no' }] } },
    { ...page, content: { blocks: [{ id: 'x', type: 'text', html: '<img>' }] } },
    { ...page, content: { blocks: [{ id: 'x', type: 'text' }, { id: 'x', type: 'text' }] } },
    { ...page, slug: '../admin' }, { ...page, status: 'live' },
  ];
  for (const input of attempts) {
    const api = remote('admin');
    const r = await routeStudioRequest(request('/api/studio/pages', 'POST', input), env, api.fetcher);
    assert.equal(r.status, 422);
    assert.equal(api.calls.length, 1);
  }
});
test('studio creates records with server-derived actor IDs and verifies returned row', async () => {
  const saved = { id: '2e5a4d65-4c8f-45d0-89d9-2f2b1bfe0c61', ...page, created_by: uid, updated_by: uid };
  const api = remote('admin', [saved]);
  const r = await routeStudioRequest(request('/api/studio/pages', 'POST', page), env, api.fetcher);
  assert.equal(r.status, 201);
  const sent = JSON.parse(api.calls[1].options.body);
  assert.equal(sent.created_by, uid);
  assert.equal(sent.updated_by, uid);
  assert.equal(sent.status, 'draft');
});
test('studio rejects invalid IDs and unsupported methods', async () => {
  assert.equal((await routeStudioRequest(request('/api/studio/pages/not-a-uuid', 'PATCH', page), env)).status, 400);
  assert.equal((await routeStudioRequest(request('/api/studio/pages', 'DELETE'), env)).status, 405);
});

test('public Studio renderer returns only published page content without a user JWT', async () => {
  const published = { id: '2e5a4d65-4c8f-45d0-89d9-2f2b1bfe0c61', slug: 'welcome-page', title: 'Welcome', content: page.content, status: 'published' };
  const calls = [];
  const fetcher = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return Response.json([published]);
  };
  const r = await routePublicStudioPage(request('/api/public/studio/pages/welcome-page', 'GET', undefined, false), env, fetcher);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), published);
  assert.match(calls[0].url, /status=eq.published/);
  assert.match(calls[0].url, /slug=eq.welcome-page/);
  assert.equal(calls[0].options.headers.Authorization, undefined);
});
test('public Studio renderer does not expose drafts or malformed slugs', async () => {
  const missing = await routePublicStudioPage(request('/api/public/studio/pages/not-published', 'GET', undefined, false), env, async () => Response.json([]));
  assert.equal(missing.status, 404);
  const malformed = await routePublicStudioPage(request('/api/public/studio/pages/../secret', 'GET', undefined, false), env, async () => {
    throw new Error('must not fetch malformed slugs');
  });
  assert.equal(malformed.status, 404);
});
