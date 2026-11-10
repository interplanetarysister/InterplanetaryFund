import test from "node:test";
import assert from "node:assert/strict";
import { BodyError, readJsonBody } from "../worker/bodyLimit.js";

const jsonRequest = (body, headers = {}) =>
  new Request("https://preview.example/api/campaigns", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });

async function rejectsWithStatus(promise, status) {
  await assert.rejects(promise, (error) => error instanceof BodyError && error.status === status);
}

test("backend JSON parser accepts a valid bounded payload", async () => {
  assert.deepEqual(await readJsonBody(jsonRequest('{"draft":true}'), 1024), { draft: true });
});

test("backend rejects non-JSON media types", async () => {
  await rejectsWithStatus(
    readJsonBody(jsonRequest("hello", { "content-type": "text/plain" }), 1024),
    415,
  );
});

test("backend rejects malformed JSON and invalid UTF-8", async () => {
  await rejectsWithStatus(readJsonBody(jsonRequest("{"), 1024), 400);
  await rejectsWithStatus(
    readJsonBody(jsonRequest(new Uint8Array([0xc3, 0x28])), 1024),
    400,
  );
});

test("backend enforces actual bytes even without a Content-Length header", async () => {
  await rejectsWithStatus(readJsonBody(jsonRequest('{"oversized":true}'), 5), 413);
});

test("backend rejects forged oversized or malformed Content-Length", async () => {
  await rejectsWithStatus(
    readJsonBody(jsonRequest("{}", { "content-length": "999999" }), 1024),
    413,
  );
  await rejectsWithStatus(
    readJsonBody(jsonRequest("{}", { "content-length": "not-a-number" }), 1024),
    413,
  );
});

test("backend enforces byte limits, not JavaScript character counts", async () => {
  await rejectsWithStatus(readJsonBody(jsonRequest('{"x":"🌍"}'), 9), 413);
});
