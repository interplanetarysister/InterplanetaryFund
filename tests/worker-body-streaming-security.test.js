import test from "node:test";
import assert from "node:assert/strict";
import { BodyError, readJsonBody } from "../worker/bodyLimit.js";

function streamedRequest(chunks, onCancel = () => {}) {
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
    },
    cancel(reason) {
      onCancel(reason);
    },
  });
  return new Request("https://preview.example/api/campaigns", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    duplex: "half",
  });
}

test("streaming JSON accepts UTF-8 split across chunk boundaries", async () => {
  const bytes = new TextEncoder().encode('{"planet":"🌍"}');
  const emojiStart = bytes.indexOf(0xf0);
  const request = streamedRequest([
    bytes.slice(0, emojiStart + 2),
    bytes.slice(emojiStart + 2),
  ]);
  assert.deepEqual(await readJsonBody(request, bytes.length), { planet: "🌍" });
});

test("streaming JSON rejects cumulative over-limit chunks and cancels reader", async () => {
  let canceled = false;
  const request = streamedRequest([
    new TextEncoder().encode('{"x":'),
    new TextEncoder().encode('"over-limit"}'),
  ], () => { canceled = true; });
  await assert.rejects(readJsonBody(request, 7), error =>
    error instanceof BodyError && error.status === 413);
  assert.equal(canceled, true, "oversized request stream should be canceled");
});

test("streaming JSON rejects malformed UTF-8 split across chunks", async () => {
  const request = streamedRequest([
    new Uint8Array([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xc3]),
    new Uint8Array([0x28, 0x22, 0x7d]),
  ]);
  await assert.rejects(readJsonBody(request, 128), error =>
    error instanceof BodyError && error.status === 400);
});
