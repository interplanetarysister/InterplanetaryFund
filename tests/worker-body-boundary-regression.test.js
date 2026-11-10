import test from "node:test";
import assert from "node:assert/strict";
import { BodyError, readJsonBody } from "../worker/bodyLimit.js";

function request(body, headers = {}) {
  return new Request("https://preview.example/api/campaigns", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

test("accepts payload exactly at byte boundary", async () => {
  const body = '{"ok":true}';
  assert.deepEqual(await readJsonBody(request(body), Buffer.byteLength(body)), { ok: true });
});

test("accepts standard JSON content type with charset parameter", async () => {
  assert.deepEqual(
    await readJsonBody(request('{"ok":true}', { "content-type": "application/json; charset=utf-8" }), 128),
    { ok: true },
  );
});

test("rejects JSON-like but unsupported media type", async () => {
  await assert.rejects(
    readJsonBody(request("{}", { "content-type": "application/jsonp" }), 128),
    (error) => error instanceof BodyError && error.status === 415,
  );
});

test("rejects empty JSON body without crashing", async () => {
  await assert.rejects(
    readJsonBody(request(""), 128),
    (error) => error instanceof BodyError && error.status === 400,
  );
});

test("rejects actual body larger than falsely small Content-Length", async () => {
  await assert.rejects(
    readJsonBody(request('{"too":"large"}', { "content-length": "2" }), 4),
    (error) => error instanceof BodyError && error.status === 413,
  );
});
