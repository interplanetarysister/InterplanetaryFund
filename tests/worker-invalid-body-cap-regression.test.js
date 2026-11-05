import test from 'node:test';
import assert from 'node:assert/strict';
import { BodyError, readJsonBody } from '../worker/bodyLimit.js';

// A configuration error must not consume an attacker-controlled stream.
for (const limit of [undefined, null, 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
  test(`invalid byte cap ${String(limit)} fails closed before reading`, async () => {
    let pulls = 0;
    const request = {
      headers: new Headers({ 'content-type': 'application/json' }),
      body: new ReadableStream({
        pull(controller) {
          pulls++;
          controller.enqueue(new TextEncoder().encode('{}'));
          controller.close();
        },
      }),
    };
    await assert.rejects(readJsonBody(request, limit),
      error => error instanceof BodyError && error.status === 500);
    assert.equal(pulls, 0);
  });
}

test('valid positive byte cap permits a minimal JSON body', async () => {
  const request = new Request('https://preview.example/api/campaigns', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  assert.deepEqual(await readJsonBody(request, 2), {});
});
