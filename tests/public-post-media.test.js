import test from 'node:test';
import assert from 'node:assert/strict';
import { routePublicPostMedia } from '../worker/media/publicPostMedia.js';

const owner = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const mediaId = 'c1234567-89ab-4def-8abc-1234567890ab';
const postId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const sha = 'a'.repeat(64);
const url = (file) => `https://interplanetaryfund.com/api/media/public/file/${file}`;

function mediaRow(overrides = {}) {
  return {
    id: mediaId, owner_id: owner, content_kind: 'video', content_type: 'video/mp4',
    file_size: 5, object_path: `private/member-media/${owner}/${mediaId}.mp4`,
    object_etag: 'etag-1', object_sha256: sha, deletion_requested_at: null,
    ...overrides,
  };
}
function makeEnv({ media = [mediaRow()], posts = [{ id: postId }], reports = [],
                   object = null, enabled = 'enabled' } = {}) {
  const seen = [];
  const fetcher = async (rawUrl, settings) => {
    seen.push({ url: String(rawUrl), settings });
    if (String(rawUrl).includes('/rest/v1/ifund_member_media?')) return Response.json(media);
    if (String(rawUrl).includes('/rest/v1/ifund_posts?')) return Response.json(posts);
    if (String(rawUrl).includes('/rest/v1/ifund_social_reports?')) return Response.json(reports);
    throw new Error('Unexpected URL ' + rawUrl);
  };
  const bucketObject = object ?? {
    size: 5, etag: 'etag-1', httpMetadata: { contentType: 'video/mp4' },
    customMetadata: { owner_id: owner, sha256: sha }, body: 'bytes',
  };
  const env = {
    SUPABASE_URL: 'https://ssibsfmtodgximseeqsv.supabase.co',
    SUPABASE_SECRET_KEY: 'sb_secret_fake_for_tests',
    IFUND_CAMPAIGN_MEDIA_ENABLED: enabled,
    IFUND_CAMPAIGN_MEDIA: { get: async () => bucketObject },
  };
  return { env, fetcher, seen };
}
const get = (file, env, fetcher, method = 'GET') =>
  routePublicPostMedia(new Request(url(file), { method }), env, fetcher);

test('serves a library video while it is attached to a visible post', async () => {
  const { env, fetcher, seen } = makeEnv();
  const r = await get(`${mediaId}.mp4`, env, fetcher);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'video/mp4');
  assert.equal(r.headers.get('content-length'), '5');
  assert.match(r.headers.get('cache-control'), /^public,/);
  assert.equal(await r.text(), 'bytes');
  // Reference checks used the server secret, never a member token.
  assert.ok(seen.every(c => c.settings.headers.apikey === 'sb_secret_fake_for_tests'));
  assert.ok(seen.every(c => !('authorization' in c.settings.headers)));
});

test('HEAD returns headers without a body', async () => {
  const { env, fetcher } = makeEnv();
  const r = await get(`${mediaId}.mp4`, env, fetcher, 'HEAD');
  assert.equal(r.status, 200);
  assert.equal(await r.text(), '');
  assert.equal(r.headers.get('content-length'), '5');
});

test('serves an attached image with its image content type', async () => {
  const image = mediaRow({ content_kind: 'image', content_type: 'image/png',
    object_path: `private/member-media/${owner}/${mediaId}.png` });
  const { env, fetcher } = makeEnv({ media: [image], object: {
    size: 5, etag: 'etag-1', httpMetadata: { contentType: 'image/png' },
    customMetadata: { owner_id: owner, sha256: sha }, body: 'bytes' } });
  const r = await get(`${mediaId}.png`, env, fetcher);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'image/png');
});

test('private library media with no public post stays unservable', async () => {
  const { env, fetcher } = makeEnv({ posts: [] });
  const r = await get(`${mediaId}.mp4`, env, fetcher);
  assert.equal(r.status, 404);
});

test('a reported post revokes playback even though the file still exists', async () => {
  const { env, fetcher } = makeEnv({ reports: [{ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }] });
  const r = await get(`${mediaId}.mp4`, env, fetcher);
  assert.equal(r.status, 404);
});

test('pending-deletion, unknown, mismatched and corrupt media are all 404', async () => {
  const cases = [
    makeEnv({ media: [mediaRow({ deletion_requested_at: '2026-11-26T00:00:00Z' })] }),
    makeEnv({ media: [] }),
    makeEnv({ object: { size: 5, etag: 'different', httpMetadata: { contentType: 'video/mp4' },
      customMetadata: { owner_id: owner, sha256: sha }, body: 'bytes' } }),
    makeEnv({ object: { size: 5, etag: 'etag-1', httpMetadata: { contentType: 'video/mp4' },
      customMetadata: { owner_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', sha256: sha }, body: 'bytes' } }),
  ];
  for (const { env, fetcher } of cases) {
    assert.equal((await get(`${mediaId}.mp4`, env, fetcher)).status, 404);
  }
  // Extension must match the stored content type.
  const { env, fetcher } = makeEnv();
  assert.equal((await get(`${mediaId}.webm`, env, fetcher)).status, 404);
  assert.equal((await get(`${mediaId}.png`, env, fetcher)).status, 404);
});

test('route fails closed on bad names, methods and missing configuration', async () => {
  const { env, fetcher } = makeEnv();
  assert.equal((await get('not-a-file.mp4', env, fetcher)).status, 404);
  assert.equal((await get(`${mediaId}.exe`, env, fetcher)).status, 404);
  assert.equal((await get(`${mediaId}.mp4`, env, fetcher, 'POST')).status, 405);
  assert.equal((await get(`${mediaId}.mp4`, env, fetcher, 'DELETE')).status, 405);
  const off = makeEnv({ enabled: 'disabled' });
  assert.equal((await get(`${mediaId}.mp4`, off.env, off.fetcher)).status, 503);
  const noSecret = makeEnv();
  delete noSecret.env.SUPABASE_SECRET_KEY;
  assert.equal((await get(`${mediaId}.mp4`, noSecret.env, noSecret.fetcher)).status, 503);
});
