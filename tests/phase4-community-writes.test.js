import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import { routeCommunityWrite } from '../worker/communityWrites.js';

const env = {
  MIGRATION_API_PREVIEW: 'enabled',
  SUPABASE_URL: 'https://ssibsfmtodgximseeqsv.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fake_for_tests',
};
const uid = 'a09c3b82-1758-454d-912c-e69ea4136daa';
const other = '9baa21da-845b-46d9-9476-a41c38564756';
const postId = 'b7486a53-40a8-4a71-8377-141332ab4341';
const base = 'https://api.example.org';

function makeRequest(method, path, payload, authorization = 'Bearer signed.test.jwt') {
  return new Request(base + path, {
    method,
    headers: {
      ...(authorization ? { authorization } : {}),
      ...(payload === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
}
function mock(calls, options = {}) {
  return async (url, settings) => {
    calls.push({ url: String(url), settings });
    if (String(url).endsWith('/auth/v1/user')) {
      return Response.json({ id: uid, email_confirmed_at: '2026-10-01T00:00:00.000Z' });
    }
    if (String(url).includes('account_status')) {
      return Response.json([{ id: uid, account_status: 'active', account_deletion_pending: false }]);
    }
    if (options.error) return new Response('private diagnostic', { status: 500 });
    if (options.rows) return Response.json(options.rows);
    const row = settings.method === 'POST'
      ? { id: postId, author_id: uid, body: JSON.parse(settings.body).body, created_at: '2026-10-25T00:00:00Z' }
      : { id: postId, author_id: uid, body: 'Hello' };
    return Response.json([row]);
  };
}
test('router keeps community writes disabled without explicit migration flag', async () => {
  const create = await worker.fetch(makeRequest('POST', '/api/community/posts', { body: 'Hello' }));
  assert.equal(create.status, 503);
  const remove = await worker.fetch(makeRequest('DELETE', '/api/community/posts/' + postId));
  assert.equal(remove.status, 503);
});
test('anonymous creation is rejected without a database write', async () => {
  const calls = [];
  const req = makeRequest('POST', '/api/community/posts', { body: 'Hello' }, null);
  const r = await routeCommunityWrite(req, env, mock(calls));
  assert.equal(r.status, 401);
  assert.equal(calls.length, 0);
});
test('new post derives author from verified Auth and forwards user bearer to RLS', async () => {
  const calls = [];
  const r = await routeCommunityWrite(makeRequest('POST', '/api/community/posts',
    { body: ' Hello friends ' }), env, mock(calls));
  assert.equal(r.status, 201);
  assert.deepEqual(await r.json(), {
    id: postId, body: 'Hello friends', created_at: '2026-10-25T00:00:00Z',
  });
  assert.equal(calls.length, 3);
  assert.ok(calls[0].url.endsWith('/auth/v1/user'));
  assert.ok(calls[2].url.includes('/rest/v1/ifund_posts?'));
  assert.equal(calls[2].settings.method, 'POST');
  assert.equal(calls[2].settings.headers.apikey, env.SUPABASE_PUBLISHABLE_KEY);
  assert.equal(calls[2].settings.headers.Authorization, 'Bearer signed.test.jwt');
  assert.equal(calls[2].settings.headers.Prefer, 'return=representation');
  assert.deepEqual(JSON.parse(calls[2].settings.body), {
    author_id: uid, body: 'Hello friends',
  });
});
test('identity and privileged fields cannot be supplied by browser', async () => {
  for (const payload of [
    { body: 'Allowed?', author_id: other },
    { body: 'Allowed?', super_admin: true },
    { body: 'Allowed?', created_at: '2020-01-01' },
    { body: '' },
    { body: ' \n ' },
    { body: 'x'.repeat(2001) },
    { body: 12 },
    [ { body: 'not an object' } ],
  ]) {
    const calls = [];
    const r = await routeCommunityWrite(
      makeRequest('POST', '/api/community/posts', payload), env, mock(calls),
    );
    assert.equal(r.status, 422);
    assert.equal(calls.length, 2); // Auth checked; no PostgREST write.
  }
});
test('delete is constrained by exact post id and verified owner', async () => {
  const calls = [];
  const r = await routeCommunityWrite(
    makeRequest('DELETE', '/api/community/posts/' + postId), env, mock(calls),
  );
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { id: postId, deleted: true });
  assert.equal(calls.length, 3);
  assert.equal(calls[2].settings.method, 'DELETE');
  assert.ok(calls[2].url.includes('id=eq.'));
  assert.ok(calls[2].url.includes(postId));
  assert.ok(calls[2].url.includes('author_id=eq.'));
  assert.ok(calls[2].url.includes(uid));
  assert.equal(calls[2].settings.body, undefined);
});
test('not-owner and missing posts are not falsely reported as deleted', async () => {
  const r = await routeCommunityWrite(
    makeRequest('DELETE', '/api/community/posts/' + postId),
    env, mock([], { rows: [] }),
  );
  assert.equal(r.status, 404);
  const r2 = await routeCommunityWrite(
    makeRequest('DELETE', '/api/community/posts/' + postId),
    env, mock([], { rows: [{ id: postId, author_id: other }] }),
  );
  assert.equal(r2.status, 503);
});
test('invalid post ids, unsupported methods, MIME and JSON fail closed', async () => {
  const calls = [];
  assert.equal((await routeCommunityWrite(
    makeRequest('DELETE', '/api/community/posts/not-uuid'), env, mock(calls),
  )).status, 400);
  assert.equal((await routeCommunityWrite(
    makeRequest('PATCH', '/api/community/posts/' + postId), env, mock(calls),
  )).status, 405);
  assert.equal((await routeCommunityWrite(
    new Request(base + '/api/community/posts', { method: 'POST', body: 'hello' }),
    env, mock(calls),
  )).status, 415);
  assert.equal(calls.length, 0);
  const r = await routeCommunityWrite(
    new Request(base + '/api/community/posts', {
      method: 'POST',
      headers: { authorization: 'Bearer signed.test.jwt', 'content-type': 'application/json' },
      body: '{"body":',
    }),
    env, mock(calls),
  );
  assert.equal(r.status, 400);
  assert.equal(calls.length, 2);
});
test('oversized post, upstream failures and unverified responses never claim success', async () => {
  const calls = [];
  const large = await routeCommunityWrite(
    makeRequest('POST', '/api/community/posts', { body: 'x'.repeat(5000) }),
    env, mock(calls),
  );
  assert.equal(large.status, 413);
  // The authenticated user was checked; no PostgREST write was attempted.
  assert.equal(calls.length, 2);
  assert.ok(calls[0].url.endsWith('/auth/v1/user'));
  const errored = await routeCommunityWrite(
    makeRequest('POST', '/api/community/posts', { body: 'Hello' }),
    env, mock([], { error: true }),
  );
  assert.equal(errored.status, 503);
  assert.doesNotMatch(await errored.text(), /private diagnostic/);
  const mismatch = await routeCommunityWrite(
    makeRequest('POST', '/api/community/posts', { body: 'Hello' }),
    env, mock([], { rows: [{ id: postId, author_id: uid, body: 'tampered' }] }),
  );
  assert.equal(mismatch.status, 503);
});

test('a write without a database-generated UUID cannot be confirmed', async () => {
  const r = await routeCommunityWrite(
    makeRequest('POST', '/api/community/posts', { body: 'Hello' }),
    env,
    mock([], { rows: [{ author_id: uid, body: 'Hello' }] }),
  );
  assert.equal(r.status, 503);
});
