import test from "node:test";
import assert from "node:assert/strict";
import { onRequest as upload } from "../functions/api/media/campaign/upload.js";
import { onRequest as readImage } from "../functions/api/media/campaign/[owner]/[file].js";

const OWNER = "981b3c34-4b04-4411-9b7b-20ae1cc2a598";
const KEY = "sb_publishable_test_public";
const env = (bucket) => ({
  IFUND_CAMPAIGN_MEDIA: bucket,
  SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: KEY,
});
const jpeg = new Uint8Array([255, 216, 255, 224, 1, 2, 3, 255, 217]);
const makeRequest = (bytes = jpeg, headers = {}) => new Request("https://preview.example/api/media/campaign/upload", {
  method: "POST",
  headers: { authorization: "Bearer test.jwt.token", "content-type": "image/jpeg", ...headers },
  body: bytes,
});
const originalFetch = globalThis.fetch;
function withAuth(t, { active = true, confirmed = true } = {}) {
  globalThis.fetch = async (url) => {
    if (String(url).includes("/auth/v1/user"))
      return Response.json({ id: OWNER, email_confirmed_at: confirmed ? "2026-01-01T00:00:00Z" : null });
    if (String(url).includes("/rest/v1/ifund_profiles"))
      return Response.json([{ account_status: active ? "active" : "suspended" }]);
    return Response.json({}, { status: 404 });
  };
  t.after(() => { globalThis.fetch = originalFetch; });
}

test("media endpoint rejects unauthenticated and mismatched content", async (t) => {
  withAuth(t);
  const bucket = { put: async () => { throw Error("unexpected write"); }, head: async () => null, get: async () => null };
  const noAuth = new Request("https://preview.example/api/media/campaign/upload", {
    method: "POST", headers: { "content-type": "image/jpeg" }, body: jpeg,
  });
  assert.equal((await upload({ request: noAuth, env: env(bucket) })).status, 401);
  assert.equal((await upload({ request: makeRequest(jpeg, { "content-type": "image/svg+xml" }), env: env(bucket) })).status, 415);
  assert.equal((await upload({ request: makeRequest(new Uint8Array([0, 1, 2])), env: env(bucket) })).status, 415);
});

test("suspended and unconfirmed members cannot upload", async (t) => {
  withAuth(t, { active: false });
  const bucket = { put: async () => { throw Error("unexpected write"); }, head: async () => null, get: async () => null };
  assert.equal((await upload({ request: makeRequest(), env: env(bucket) })).status, 401);
});

test("valid JPEG stores immutable preview media and requires verified size", async (t) => {
  withAuth(t);
  const saved = new Map();
  const bucket = {
    put: async (key, bytes, settings) => { saved.set(key, { bytes, settings }); },
    head: async (key) => ({ size: saved.get(key)?.bytes.length || 0 }),
    get: async (key) => {
      const item = saved.get(key);
      return item && { size: item.bytes.length, httpMetadata: { contentType: "image/jpeg" }, body: new Uint8Array(item.bytes) };
    },
  };
  const result = await upload({ request: makeRequest(), env: env(bucket) });
  assert.equal(result.status, 201);
  const body = await result.json();
  assert.match(body.url, new RegExp("^https://preview\\.example/api/media/campaign/" + OWNER + "/[0-9a-f-]{36}\\.jpg$"));
  assert.equal(saved.size, 1);
  const [key] = saved.keys();
  assert.ok(key.startsWith("preview/campaigns/" + OWNER + "/"));
  const url = new URL(body.url);
  const file = url.pathname.split("/").at(-1);
  const served = await readImage({ request: new Request(body.url), env: env(bucket), params: { owner: OWNER, file } });
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("content-type"), "image/jpeg");
  assert.deepEqual(new Uint8Array(await served.arrayBuffer()), jpeg);
  const traversal = await readImage({ request: new Request(body.url), env: env(bucket), params: { owner: OWNER, file: "../secret" } });
  assert.equal(traversal.status, 404);
});

test("storage missing fails closed without falsely reporting success", async (t) => {
  withAuth(t);
  const bucket = { put: async () => {}, head: async () => null, get: async () => null };
  const result = await upload({ request: makeRequest(), env: env(bucket) });
  assert.equal(result.status, 503);
  assert.equal((await result.json()).error.includes("could not confirm"), true);
  assert.equal((await upload({ request: makeRequest(), env: {} })).status, 503);
});

test("oversized streamed media fails at the 5MB boundary without writing to R2", async (t) => {
  withAuth(t);
  let writes = 0;
  const bucket = {
    put: async () => { writes++; },
    head: async () => null,
    get: async () => null,
  };
  const huge = new ReadableStream({
    start(controller) {
      controller.enqueue(jpeg);
      controller.enqueue(new Uint8Array(5 * 1024 * 1024));
      controller.close();
    },
  });
  const request = new Request("https://preview.example/api/media/campaign/upload", {
    method: "POST", headers: { authorization: "Bearer test.jwt.token", "content-type": "image/jpeg" },
    body: huge, duplex: "half",
  });
  const response = await upload({ request, env: env(bucket) });
  assert.equal(response.status, 413);
  assert.equal(writes, 0);
});

test("preview R2 paths are not available through production", async (t) => {
  withAuth(t);
  let writes = 0;
  const bucket = { put: async () => { writes++; }, head: async () => null, get: async () => null };
  const request = new Request("https://interplanetaryfund.com/api/media/campaign/upload", {
    method: "POST", headers: { authorization: "Bearer test.jwt.token", "content-type": "image/jpeg" }, body: jpeg,
  });
  assert.equal((await upload({ request, env: env(bucket) })).status, 503);
  assert.equal((await upload({ request: makeRequest(), env: { ...env(bucket), CF_PAGES_BRANCH: "main" } })).status, 503);
  assert.equal(writes, 0);
  const response = await readImage({
    request: new Request("https://interplanetaryfund.com/api/media/campaign/" + OWNER + "/22222222-2222-4222-8222-222222222222.jpg"),
    env: env(bucket), params: { owner: OWNER, file: "22222222-2222-4222-8222-222222222222.jpg" },
  });
  assert.equal(response.status, 503);
});

test("numeric Content-Length accepts a valid image and rejects invalid or oversized lengths", async (t) => {
  withAuth(t);
  let writes = 0;
  const bucket = {
    put: async () => { writes++; },
    head: async () => ({ size: jpeg.byteLength }),
    get: async () => null,
  };
  assert.equal((await upload({ request: makeRequest(jpeg, { "content-length": String(jpeg.byteLength) }), env: env(bucket) })).status, 201);
  assert.equal(writes, 1);
  for (const length of ["invalid", "0", String(5 * 1024 * 1024 + 1)]) {
    assert.equal((await upload({ request: makeRequest(jpeg, { "content-length": length }), env: env(bucket) })).status, 413);
  }
  assert.equal(writes, 1);
});
