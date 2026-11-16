import test from 'node:test';
import assert from 'node:assert/strict';
import { BodyError, readJsonBody } from '../worker/bodyLimit.js';

function streamedRequest(chunks) {
  return new Request('https://preview.example/api/campaigns', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
    duplex: 'half',
  });
}

test('split multibyte UTF-8 JSON is decoded across stream chunks', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ title: '星🚀' }));
  const emojiStart = bytes.findIndex(byte => byte === 0xf0);
  assert.ok(emojiStart > 0);
  const result = await readJsonBody(streamedRequest([
    bytes.subarray(0, emojiStart + 1),
    bytes.subarray(emojiStart + 1),
  ]), bytes.length);
  assert.deepEqual(result, { title: '星🚀' });
});

test('invalid UTF-8 fails closed instead of silently replacing characters', async () => {
  const bytes = new Uint8Array([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xc3, 0x28, 0x22, 0x7d]);
  await assert.rejects(readJsonBody(streamedRequest([bytes]), 1024),
    error => error instanceof BodyError && error.status === 400);
});

test('exact byte limit is accepted, one additional byte is rejected', async () => {
  const bytes = new TextEncoder().encode('{"ok":true}');
  assert.deepEqual(await readJsonBody(streamedRequest([bytes]), bytes.length), { ok: true });
  await assert.rejects(readJsonBody(streamedRequest([bytes]), bytes.length - 1),
    error => error instanceof BodyError && error.status === 413);
});
