import test from "node:test";
import assert from "node:assert/strict";
import { BodyError, readJsonBody } from "../worker/bodyLimit.js";

function request(body) {
  return new Request("https://preview.example/api/campaigns", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    duplex: "half",
  });
}

test("broken request stream fails closed with a client error", async () => {
  const stream = new ReadableStream({
    start(controller) { controller.error(new Error("connection interrupted")); },
  });
  await assert.rejects(readJsonBody(request(stream), 1024),
    error => error instanceof BodyError && error.status === 400);
});

test("non-byte streamed chunks cancel the body and reject as invalid JSON", async () => {
  let canceled = false;
  const stream = new ReadableStream({
    start(controller) { controller.enqueue("not bytes"); },
    cancel() { canceled = true; },
  });
  await assert.rejects(readJsonBody(request(stream), 1024),
    error => error instanceof BodyError && error.status === 400);
  assert.equal(canceled, true);
});

test("valid streaming JSON remains accepted", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"draft":'));
      controller.enqueue(new TextEncoder().encode('true}'));
      controller.close();
    },
  });
  assert.deepEqual(await readJsonBody(request(stream), 1024), { draft: true });
});
