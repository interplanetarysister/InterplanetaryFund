import test from 'node:test';
import assert from 'node:assert/strict';
import { BodyError, readJsonBody } from '../worker/bodyLimit.js';

test('oversized streaming requests cancel the source without reading subsequent chunks', async () => {
  let pulls = 0;
  let cancellations = 0;
  const body = new ReadableStream({
    pull(controller) {
      pulls += 1;
      if (pulls === 1) controller.enqueue(new Uint8Array(65));
      else controller.enqueue(new TextEncoder().encode('{"unexpected":true}'));
    },
    cancel() { cancellations += 1; },
  }, { highWaterMark: 0 });
  const request = new Request('https://preview.example/api/campaigns', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    duplex: 'half',
  });
  await assert.rejects(
    readJsonBody(request, 64),
    error => error instanceof BodyError && error.status === 413,
  );
  assert.equal(pulls, 1, 'must not consume additional request chunks');
  assert.equal(cancellations, 1, 'must cancel the source on limit breach');
});

test('empty JSON stream fails closed with 400', async () => {
  const request = new Request('https://preview.example/api/campaigns', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: new Uint8Array(0),
  });
  await assert.rejects(
    readJsonBody(request, 64),
    error => error instanceof BodyError && error.status === 400,
  );
});
