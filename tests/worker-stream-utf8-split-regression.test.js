import test from 'node:test';
import assert from 'node:assert/strict';
import { BodyError, readJsonBody } from '../worker/bodyLimit.js';

test('invalid UTF-8 split across streaming chunks is rejected, not silently replaced', async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(Uint8Array.of(0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xc3));
      controller.enqueue(Uint8Array.of(0x28, 0x22, 0x7d));
      controller.close();
    },
  });
  const request = new Request('https://preview.example/api/campaigns', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: stream,
    duplex: 'half',
  });
  await assert.rejects(readJsonBody(request, 64),
    error => error instanceof BodyError && error.status === 400);
});

test('valid multibyte UTF-8 split across chunks is preserved', async () => {
  const encoded = new TextEncoder().encode(JSON.stringify({ title: '🚀' }));
  const split = encoded.indexOf(0xf0) + 2;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoded.slice(0, split));
      controller.enqueue(encoded.slice(split));
      controller.close();
    },
  });
  const request = new Request('https://preview.example/api/campaigns', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: stream,
    duplex: 'half',
  });
  assert.deepEqual(await readJsonBody(request, encoded.byteLength), { title: '🚀' });
});
