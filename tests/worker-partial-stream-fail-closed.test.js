import test from 'node:test';
import assert from 'node:assert/strict';
import { BodyError, readJsonBody } from '../worker/bodyLimit.js';

test('does not accept a complete-looking JSON prefix if the stream later fails', async () => {
  const stream = new ReadableStream({
    pull(controller) {
      controller.enqueue(new TextEncoder().encode('{"published":true}'));
      controller.error(new Error('upstream disconnected'));
    },
  });
  const request = new Request('https://preview.example/api/campaigns', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: stream,
    duplex: 'half',
  });
  await assert.rejects(
    readJsonBody(request, 256),
    error => error instanceof BodyError && error.status === 400,
  );
});

test('does not trust a declared short length when the actual stream exceeds the limit', async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"draft":"'));
      controller.enqueue(new Uint8Array(512).fill(97));
    },
    cancel() { cancelled = true; },
  });
  const request = new Request('https://preview.example/api/campaigns', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'content-length': '2' },
    body: stream,
    duplex: 'half',
  });
  await assert.rejects(
    readJsonBody(request, 128),
    error => error instanceof BodyError && error.status === 413,
  );
  assert.equal(cancelled, true);
});
