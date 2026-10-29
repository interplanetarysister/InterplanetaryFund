import test from 'node:test';
import assert from 'node:assert/strict';
import { readJsonBody, BodyError } from '../worker/bodyLimit.js';

function request(chunks, opts = {}) {
  return new Request('https://ifund.invalid/test', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(opts.headers || {}),
    },
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
        controller.close();
      },
    }),
    duplex: 'half',
  });
}

test('streams small JSON payload successfully', async () => {
  const data = await readJsonBody(request(['{"he', 'llo":', '"world"}']), 100);
  assert.deepEqual(data, { hello: 'world' });
});

test('rejects bodies bigger than bound even when content length is absent', async () => {
  await assert.rejects(
    readJsonBody(request(['{"name":"', 'x'.repeat(60), '"}']), 20),
    (error) => error instanceof BodyError && error.status === 413,
  );
});

test('does not trust short Content-Length when streaming oversized request', async () => {
  await assert.rejects(
    readJsonBody(request(['{"x":"', 'x'.repeat(50), '"}'], {
      headers: { 'content-length': '2' },
    }), 20),
    (error) => error instanceof BodyError && error.status === 413,
  );
});

test('rejects declared oversized length without buffering body', async () => {
  await assert.rejects(
    readJsonBody(request(['{}'], { headers: { 'content-length': '9999' } }), 30),
    (error) => error instanceof BodyError && error.status === 413,
  );
});

test('malformed JSON and invalid UTF-8 are rejected safely', async () => {
  await assert.rejects(readJsonBody(request(['{not JSON']), 100),
    (error) => error instanceof BodyError && error.status === 400);
  const req = new Request('https://ifund.invalid', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: new Uint8Array([0xc3, 0x28]),
    duplex: 'half',
  });
  await assert.rejects(readJsonBody(req, 100),
    (error) => error instanceof BodyError && error.status === 400);
});

test('content-type is required for JSON operations', async () => {
  const req = new Request('https://ifund.invalid', { method: 'POST', body: '{}' });
  await assert.rejects(readJsonBody(req, 100),
    (error) => error instanceof BodyError && error.status === 415);
});
