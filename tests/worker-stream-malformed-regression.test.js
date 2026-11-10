import test from "node:test";
import assert from "node:assert/strict";
import { BodyError, readJsonBody } from "../worker/bodyLimit.js";

function requestWithStream(stream, headers = {}) {
  return new Request("https://preview.example/api/campaigns", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: stream,
    duplex: "half",
  });
}

test("streamed JSON rejects a non-byte chunk without treating it as JSON", async () => {
  const stream = new ReadableStream({
    start(controller) { controller.enqueue('{"trusted":true}'); controller.close(); },
  });
  const request = requestWithStream(stream);
  await assert.rejects(readJsonBody(request, 1024), error =>
    error instanceof BodyError && error.status === 400);
});

test("streamed JSON does not trust a smaller forged Content-Length", async () => {
  const payload = new TextEncoder().encode('{"payload":"longer-than-declared"}');
  let canceled = false;
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(payload); },
    cancel() { canceled = true; },
  });
  const request = requestWithStream(stream, { "content-length": "1" });
  await assert.rejects(readJsonBody(request, 10), error =>
    error instanceof BodyError && error.status === 413);
  assert.equal(canceled, true);
});

test("streamed JSON rejects an incomplete multibyte UTF-8 suffix", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xf0, 0x9f]));
      controller.close();
    },
  });
  await assert.rejects(readJsonBody(requestWithStream(stream), 1024), error =>
    error instanceof BodyError && error.status === 400);
});
