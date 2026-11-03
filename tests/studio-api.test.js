import test from 'node:test';
import assert from 'node:assert/strict';
import { routeStudioRequest, routePublicStudioPage, routeStudioGenerateRequest, routeStudioStatusRequest, routeStudioVersionRequest } from '../worker/studioRoutes.js';

const uid = 'a09c3b82-1758-454d-912c-e69ea4136daa';
const env = { IFUND_STUDIO_ENABLED: 'enabled', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only' };
function request(path, method = 'GET', body, auth = true) {
  return new Request('https://ifund.example' + path, {
    method,
    headers: { ...(auth ? { authorization: 'Bearer verified.test.jwt' } : {}),
      ...(method === 'PATCH' || path.endsWith('/restore') ? { 'if-match': '2026-11-03T12:00:00.000Z' } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function remote(role, rows = []) {
  const calls = [];
  const fetcher = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: uid, app_metadata: { role } });
    if (String(url).endsWith('/rpc/ifund_current_user_is_verified_super_admin')) return Response.json(role === 'super_admin');
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
test('studio rejects ordinary members without a verified owner mapping or admin role', async () => {
  const api = remote('member');
  const r = await routeStudioRequest(request('/api/studio/pages'), env, api.fetcher);
  assert.equal(r.status, 403);
  assert.equal(api.calls.length, 2);
  assert.match(api.calls[1].url, /rpc\/ifund_current_user_is_verified_super_admin/);
});
test('studio allows a verified legacy owner mapping without an app_metadata role', async () => {
  const calls = [];
  const fetcher = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: uid, app_metadata: {} });
    if (String(url).endsWith('/rpc/ifund_current_user_is_verified_super_admin')) return Response.json(true);
    return Response.json([]);
  };
  const r = await routeStudioRequest(request('/api/studio/pages'), env, fetcher);
  assert.equal(r.status, 200);
  assert.match(calls[1].url, /rpc\/ifund_current_user_is_verified_super_admin/);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer verified.test.jwt');
  assert.match(calls[2].url, /ifund_studio_pages/);
});
test('studio allows admin and reads page data through the member JWT', async () => {
  const row = { id: '2e5a4d65-4c8f-45d0-89d9-2f2b1bfe0c61', ...page, created_by: uid, updated_by: uid };
  const api = remote('super_admin', [row]);
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
    const api = remote('super_admin');
    const r = await routeStudioRequest(request('/api/studio/pages', 'POST', input), env, api.fetcher);
    assert.equal(r.status, 422);
    assert.equal(api.calls.length, 1);
  }
});
test('studio creates records with server-derived actor IDs and verifies returned row', async () => {
  const saved = { id: '2e5a4d65-4c8f-45d0-89d9-2f2b1bfe0c61', ...page, created_by: uid, updated_by: uid };
  const api = remote('super_admin', [saved]);
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

test('studio accepts safe relative links and rejects protocol-relative or script URLs', async () => {
  const relativePage = {
    slug: 'call-to-action',
    title: 'Call to action',
    content: { blocks: [{ id: 'cta', type: 'button', label: 'Explore', url: '/' }] },
    status: 'draft',
  };
  const saved = { id: '2e5a4d65-4c8f-45d0-89d9-2f2b1bfe0c61', ...relativePage, created_by: uid, updated_by: uid };
  const api = remote('super_admin', [saved]);
  const accepted = await routeStudioRequest(request('/api/studio/pages', 'POST', relativePage), env, api.fetcher);
  assert.equal(accepted.status, 201);
  for (const url of ['//attacker.example', 'javascript:alert(1)']) {
    const bad = { ...relativePage, slug: 'unsafe-link', content: { blocks: [{ id: 'cta', type: 'button', label: 'Go', url }] } };
    const rejected = await routeStudioRequest(request('/api/studio/pages', 'POST', bad), env, remote('super_admin').fetcher);
    assert.equal(rejected.status, 422);
  }
});

test('Studio AI is disabled unless explicitly enabled with a Workers AI binding', async () => {
  const disabled = await routeStudioGenerateRequest(
    request('/api/studio/generate', 'POST', { prompt: 'Create a campaign landing page' }),
    env,
  );
  assert.equal(disabled.status, 503);
});
test('Studio AI enforces admin role and the shared daily quota before inference', async () => {
  const aiEnv = { ...env, IFUND_STUDIO_AI_ENABLED: 'enabled', AI: { run: async () => {
    throw new Error('AI must not run when quota is exhausted');
  } } };
  const memberFetcher = async (url) => Response.json({ id: uid, app_metadata: { role: 'member' } });
  const denied = await routeStudioGenerateRequest(
    request('/api/studio/generate', 'POST', { prompt: 'Create a campaign landing page' }),
    aiEnv,
    memberFetcher,
  );
  assert.equal(denied.status, 403);

  const exhaustedFetcher = async (url) => {
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: uid, app_metadata: { role: 'super_admin' } });
    if (String(url).endsWith('/rpc/ifund_current_user_is_verified_super_admin')) return Response.json(true);
    return Response.json(false);
  };
  const limited = await routeStudioGenerateRequest(
    request('/api/studio/generate', 'POST', { prompt: 'Create a campaign landing page' }),
    aiEnv,
    exhaustedFetcher,
  );
  assert.equal(limited.status, 429);
});
test('Studio AI returns a validated visual draft and never saves it automatically', async () => {
  let calls = 0;
  let aiCalls = 0;
  const aiEnv = {
    ...env,
    IFUND_STUDIO_AI_ENABLED: 'enabled',
    AI: {
      run: async (model, input) => {
        aiCalls += 1;
        assert.equal(model, '@cf/zai-org/glm-4.7-flash');
        assert.equal(input.max_tokens, 700);
        return { response: JSON.stringify({ blocks: [
          { type: 'hero', heading: 'A better future', body: 'Help make it happen.' },
          { type: 'button', heading: 'Take action', label: 'Explore', url: '/' },
        ] }) };
      },
    },
  };
  const fetcher = async (url, options = {}) => {
    calls += 1;
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: uid, app_metadata: { role: 'super_admin' } });
    assert.match(String(url), /rpc\/ifund_studio_consume_ai_quota/);
    return Response.json(true);
  };
  const r = await routeStudioGenerateRequest(
    request('/api/studio/generate', 'POST', { prompt: 'Create a campaign landing page with a clear action' }),
    aiEnv,
    fetcher,
  );
  assert.equal(r.status, 200);
  const result = await r.json();
  assert.equal(result.content.blocks.length, 2);
  assert.equal(result.content.blocks[0].id, 'ai-1');
  assert.equal(result.content.blocks[1].url, '/');
  assert.equal(aiCalls, 1);
  assert.equal(calls, 2);
});
test('Studio AI rejects short or oversized prompts before consuming quota', async () => {
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    if (String(arguments[0] || '').endsWith('/rpc/ifund_current_user_is_verified_super_admin')) return Response.json(true);
    return Response.json({ id: uid, app_metadata: { role: 'super_admin' } });
  };
  const aiEnv = { ...env, IFUND_STUDIO_AI_ENABLED: 'enabled', AI: { run: async () => ({ response: '{}' }) } };
  const short = await routeStudioGenerateRequest(
    request('/api/studio/generate', 'POST', { prompt: 'short' }),
    aiEnv,
    fetcher,
  );
  assert.equal(short.status, 422);
  assert.equal(calls, 1);
});

test('Studio status is admin-only and reports AI disabled until explicitly enabled', async () => {
  const api = remote('super_admin');
  const r = await routeStudioStatusRequest(request('/api/studio/status'), env, api.fetcher);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), {
    pageBuilderEnabled: true,
    aiEnabled: false,
    aiDailyLimit: 2,
  });
  const member = await routeStudioStatusRequest(
    request('/api/studio/status'),
    env,
    remote('member').fetcher,
  );
  assert.equal(member.status, 403);
});

test('Studio version history is admin-only and returns recent immutable revisions', async () => {
  const pageId = '2e5a4d65-4c8f-45d0-89d9-2f2b1bfe0c61';
  const revisions = [{ id: 'rev-2', page_id: pageId, version: 2, ...page, created_at: '2026-11-03T12:00:00Z' }];
  const api = remote('super_admin', revisions);
  const r = await routeStudioVersionRequest(request('/api/studio/pages/' + pageId + '/versions'), env, api.fetcher);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), revisions);
  assert.match(api.calls[1].url, /ifund_studio_page_versions/);
  assert.equal(api.calls[1].options.headers.Authorization, 'Bearer verified.test.jwt');

  const denied = await routeStudioVersionRequest(
    request('/api/studio/pages/' + pageId + '/versions'),
    env,
    remote('member').fetcher,
  );
  assert.equal(denied.status, 403);
});
test('Studio revision restore creates a draft from a verified snapshot', async () => {
  const pageId = '2e5a4d65-4c8f-45d0-89d9-2f2b1bfe0c61';
  const snapshot = { page_id: pageId, slug: 'older-page', title: 'Older title', content: page.content, status: 'published' };
  const restored = { id: pageId, slug: snapshot.slug, title: snapshot.title, content: snapshot.content,
    status: 'draft', updated_by: uid, published_at: null };
  const calls = [];
  const fetcher = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: uid, app_metadata: { role: 'super_admin' } });
    if (String(url).endsWith('/rpc/ifund_current_user_is_verified_super_admin')) return Response.json(true);
    if (String(url).includes('/ifund_studio_page_versions?')) return Response.json([snapshot]);
    return Response.json([restored]);
  };
  const r = await routeStudioVersionRequest(
    request('/api/studio/pages/' + pageId + '/versions/1/restore', 'POST'),
    env,
    fetcher,
  );
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), restored);
  const sent = JSON.parse(calls[2].options.body);
  assert.equal(sent.status, 'draft');
  assert.equal(sent.published_at, null);
  assert.equal(sent.updated_by, uid);
});
