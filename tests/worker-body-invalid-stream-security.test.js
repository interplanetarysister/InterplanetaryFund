import test from "node:test";
import assert from "node:assert/strict";
import { BodyError, readJsonBody } from "../worker/bodyLimit.js";

function requestWithStream(chunks, headers = {}) {
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Request("https://preview.example/api/campaigns", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: stream,
    duplex: "half",
  });
}

test("rejects a non-byte request stream chunk without coercing it", async () => {
  const request = requestWithStream(['{"ok":true}']);
  await assert.rejects(readJsonBody(request, 128),
    error => error instanceof BodyError && error.status === 400);
});

test("rejects a non-numeric Content-Length without consuming the body", async () => {
  const request = requestWithStream([new TextEncoder().encode("{}")], {
    "content-length": "not-a-number",
  });
  await assert.rejects(readJsonBody(request, 128),
    error => error instanceof BodyError && error.status === 413);
});

test("rejects Content-Length above the limit before reading a stream", async () => {
  const request = requestWithStream([new TextEncoder().encode("{}")], {
    "content-length": "9999",
  });
  await assert.rejects(readJsonBody(request, 128),
    error => error instanceof BodyError && error.status === 413);
});

test("rejects syntactically malformed JSON with a 400", async () => {
  const request = requestWithStream([new TextEncoder().encode('{"x":}')]);
  await assert.rejects(readJsonBody(request, 128),
    error => error instanceof BodyError && error.status === 400);
});
