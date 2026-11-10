import test from 'node:test';
import assert from 'node:assert/strict';
import { BodyError, readJsonBody } from '../worker/bodyLimit.js';

const endpoint = 'https://preview.example/api/campaigns';
const isStatus = (status) => (error) => error instanceof BodyError && error.status === status;

function streamedRequest(chunks, headers = {}) {
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
  return new Request(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
    duplex: 'half',
  });
}

test('forged small Content-Length cannot bypass streamed byte limit', async () => {
  const chunks = ['{"title":"', 'A'.repeat(256), '"}'];
  await assert.rejects(
    readJsonBody(streamedRequest(chunks, { 'content-length': '1' }), 64),
    isStatus(413),
  );
});

test('oversized declared Content-Length is rejected before reading body', async () => {
  await assert.rejects(
    readJsonBody(streamedRequest(['{"title":"ok"}'], { 'content-length': '999999999999999999999' }), 64),
    isStatus(413),
  );
});

test('non-numeric Content-Length is rejected', async () => {
  await assert.rejects(
    readJsonBody(streamedRequest(['{}'], { 'content-length': 'invalid' }), 64),
    isStatus(413),
  );
});

test('JSON with an allowed content type and exact byte boundary succeeds', async () => {
  const chunks = ['{"title":', '"ok"}'];
  const byteLength = Buffer.byteLength(chunks.join(''), 'utf8');
  assert.deepEqual(
    await readJsonBody(streamedRequest(chunks, { 'content-type': 'application/json; charset=utf-8' }), byteLength),
    { title: 'ok' },
  );
});

test('non-JSON content type is rejected even for syntactically valid JSON', async () => {
  await assert.rejects(
    readJsonBody(streamedRequest(['{}'], { 'content-type': 'text/plain' }), 64),
    isStatus(415),
  );
});
