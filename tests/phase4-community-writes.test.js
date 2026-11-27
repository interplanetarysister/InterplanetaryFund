import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import { routeCommunityWrite } from '../worker/communityWrites.js';

const env = {
  MIGRATION_API_PREVIEW: 'enabled',
  SUPABASE_URL: 'https://example.supabase.co',
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
      return Response.json({ id: uid });
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
  assert.equal(calls.length, 2);
  assert.ok(calls[0].url.endsWith('/auth/v1/user'));
  assert.ok(calls[1].url.includes('/rest/v1/ifund_posts?'));
  assert.equal(calls[1].settings.method, 'POST');
  assert.equal(calls[1].settings.headers.apikey, env.SUPABASE_PUBLISHABLE_KEY);
  assert.equal(calls[1].settings.headers.Authorization, 'Bearer signed.test.jwt');
  assert.equal(calls[1].settings.headers.Prefer, 'return=representation');
  assert.deepEqual(JSON.parse(calls[1].settings.body), {
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
    assert.equal(calls.length, 1); // Auth checked; no PostgREST write.
  }
});
test('delete is constrained by exact post id and verified owner', async () => {
  const calls = [];
  const r = await routeCommunityWrite(
    makeRequest('DELETE', '/api/community/posts/' + postId), env, mock(calls),
  );
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { id: postId, deleted: true });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].settings.method, 'DELETE');
  assert.ok(calls[1].url.includes('id=eq.'));
  assert.ok(calls[1].url.includes(postId));
  assert.ok(calls[1].url.includes('author_id=eq.'));
  assert.ok(calls[1].url.includes(uid));
  assert.equal(calls[1].settings.body, undefined);
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
  assert.equal(calls.length, 1);
});
test('oversized post, upstream failures and unverified responses never claim success', async () => {
  const calls = [];
  const large = await routeCommunityWrite(
    makeRequest('POST', '/api/community/posts', { body: 'x'.repeat(5000) }),
    env, mock(calls),
  );
  assert.equal(large.status, 413);
  // The authenticated user was checked; no PostgREST write was attempted.
  assert.equal(calls.length, 1);
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

const mediaId = 'c1234567-89ab-4def-8abc-1234567890ab';
function mediaRow(overrides = {}) {
  return {
    id: mediaId, owner_id: uid, content_kind: 'video', content_type: 'video/mp4',
    file_size: 1024, object_path: `private/member-media/${uid}/${mediaId}.mp4`,
    object_etag: 'etag-1', object_sha256: 'a'.repeat(64), deletion_requested_at: null,
    ...overrides,
  };
}
function mediaMock(calls, mediaRows) {
  return async (url, settings) => {
    calls.push({ url: String(url), settings });
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: uid });
    if (String(url).includes('/rest/v1/ifund_member_media?')) return Response.json(mediaRows);
    const parsed = JSON.parse(settings.body);
    return Response.json([{ id: postId, author_id: uid, body: parsed.body,
      media_id: parsed.media_id ?? null, created_at: '2026-10-25T00:00:00Z' }]);
  };
}
test('post with the author\'s own library video attaches after owner-scoped verification', async () => {
  const calls = [];
  const r = await routeCommunityWrite(
    makeRequest('POST', '/api/community/posts', { body: 'Watch this', media_id: mediaId }),
    env, mediaMock(calls, [mediaRow()]),
  );
  assert.equal(r.status, 201);
  assert.deepEqual(await r.json(), {
    id: postId, body: 'Watch this', created_at: '2026-10-25T00:00:00Z', media_id: mediaId,
  });
  assert.equal(calls.length, 3);
  assert.ok(calls[1].url.includes('/rest/v1/ifund_member_media?'));
  assert.ok(calls[1].url.includes('owner_id=eq.' + uid));
  assert.ok(calls[1].url.includes('id=eq.' + mediaId));
  assert.equal(calls[1].settings.headers.Authorization, calls[2].settings.headers.Authorization);
  assert.deepEqual(JSON.parse(calls[2].settings.body), {
    author_id: uid, body: 'Watch this', media_id: mediaId,
  });
});
test('post with the author\'s own library image attaches', async () => {
  const calls = [];
  const image = mediaRow({ content_kind: 'image', content_type: 'image/png',
    object_path: `private/member-media/${uid}/${mediaId}.png`, file_size: 2048 });
  const r = await routeCommunityWrite(
    makeRequest('POST', '/api/community/posts', { body: 'Photo', media_id: mediaId }),
    env, mediaMock(calls, [image]),
  );
  assert.equal(r.status, 201);
  assert.equal((await r.json()).media_id, mediaId);
});
test('another member\'s media, audio and pending-deletion media never attach', async () => {
  for (const rows of [
    [], // Owner-scoped lookup finds nothing for someone else's file.
    [mediaRow({ content_kind: 'audio', content_type: 'audio/mpeg',
      object_path: `private/member-media/${uid}/${mediaId}.mp3` })],
    [mediaRow({ deletion_requested_at: '2026-10-25T00:00:00Z' })],
    [mediaRow({ object_path: 'private/member-media/someone-else.mp4' })],
    [mediaRow({ object_sha256: 'not-a-sha' })],
  ]) {
    const calls = [];
    const r = await routeCommunityWrite(
      makeRequest('POST', '/api/community/posts', { body: 'Nope', media_id: mediaId }),
      env, mediaMock(calls, rows),
    );
    assert.equal(r.status, 422);
    assert.equal((await r.json()).error, 'Attached media could not be verified.');
    // Auth + media lookup happened; the post insert was never attempted.
    assert.equal(calls.length, 2);
    assert.ok(!calls.some(c => c.url.includes('/rest/v1/ifund_posts?')));
  }
});
test('malformed media references fail before any database lookup', async () => {
  for (const payload of [
    { body: 'Hi', media_id: 'not-a-uuid' },
    { body: 'Hi', media_id: 42 },
    { body: 'Hi', media_id: mediaId, author_id: other },
  ]) {
    const calls = [];
    const r = await routeCommunityWrite(
      makeRequest('POST', '/api/community/posts', payload), env, mediaMock(calls, [mediaRow()]),
    );
    assert.equal(r.status, 422);
    assert.equal(calls.length, 1); // Auth only.
  }
});
