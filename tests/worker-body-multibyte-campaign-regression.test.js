import test from 'node:test';
import assert from 'node:assert/strict';
import { BodyError, readJsonBody } from '../worker/bodyLimit.js';

function request(body) {
  return new Request('https://preview.example/api/campaigns', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

test('multibyte campaign text is limited by UTF-8 bytes, not character count', async () => {
  const body = JSON.stringify({ title: '🚀星' });
  const bytes = Buffer.byteLength(body, 'utf8');
  assert.ok(bytes > body.length);
  assert.deepEqual(await readJsonBody(request(body), bytes), { title: '🚀星' });
  await assert.rejects(readJsonBody(request(body), bytes - 1),
    (error) => error instanceof BodyError && error.status === 413);
});

test('truncated multibyte UTF-8 fails closed even when byte limit allows it', async () => {
  const bytes = Buffer.from(JSON.stringify({ title: '🚀' }));
  const rocket = Buffer.from('🚀');
  const at = bytes.indexOf(rocket);
  assert.ok(at >= 0);
  const corrupted = Buffer.concat([bytes.subarray(0, at + 2), bytes.subarray(at + 4)]);
  await assert.rejects(readJsonBody(request(corrupted), 1024),
    (error) => error instanceof BodyError && error.status === 400);
});
