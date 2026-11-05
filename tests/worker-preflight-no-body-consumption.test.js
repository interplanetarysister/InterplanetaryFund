import test from 'node:test';
import assert from 'node:assert/strict';
import { BodyError, readJsonBody } from '../worker/bodyLimit.js';

function guardedRequest(headers) {
  let reads = 0;
  const body = new ReadableStream({
    pull(controller) {
      reads += 1;
      controller.enqueue(new TextEncoder().encode('{"shouldNotRead":true}'));
      controller.close();
    },
  });
  return {
    request: { headers: new Headers(headers), body },
    get reads() { return reads; },
  };
}

for (const [name, headers, expected] of [
  ['unsupported content type', { 'content-type': 'text/plain' }, 415],
  ['declared oversized body', { 'content-type': 'application/json', 'content-length': '1025' }, 413],
  ['malformed length', { 'content-type': 'application/json', 'content-length': '-1' }, 413],
]) {
  test(`rejects ${name} before consuming request stream`, async () => {
    const guarded = guardedRequest(headers);
    await assert.rejects(readJsonBody(guarded.request, 1024),
      error => error instanceof BodyError && error.status === expected);
    assert.equal(guarded.reads, 0);
  });
}
