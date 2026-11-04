import test from 'node:test';
import assert from 'node:assert/strict';
import { BodyError, readJsonBody } from '../worker/bodyLimit.js';

function request(bytes, headers = {}) {
  return new Request('https://preview.example/api/campaigns', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: bytes,
  });
}

test('rejects JSON-looking content with unsupported media types', async () => {
  for (const mime of ['text/plain', 'application/jsonp', 'application/vnd.api+json', '']) {
    await assert.rejects(
      readJsonBody(request('{"ok":true}', { 'content-type': mime }), 1024),
      error => error instanceof BodyError && error.status === 415,
      mime,
    );
  }
});

test('rejects non-decimal and oversized declared content lengths', async () => {
  for (const length of ['-1', '1.5', '1e3', ' 9', '999999999999999999999']) {
    await assert.rejects(
      readJsonBody(request('{"ok":true}', { 'content-length': length }), 64),
      error => error instanceof BodyError && error.status === 413,
      length,
    );
  }
});

test('allows JSON charset parameter without weakening the byte limit', async () => {
  const body = '{"name":"🚀"}';
  const bytes = new TextEncoder().encode(body);
  assert.deepEqual(
    await readJsonBody(request(bytes, { 'content-type': 'Application/JSON; charset=utf-8' }), bytes.length),
    { name: '🚀' },
  );
  await assert.rejects(
    readJsonBody(request(bytes, { 'content-type': 'application/json; charset=utf-8' }), bytes.length - 1),
    error => error instanceof BodyError && error.status === 413,
  );
});
