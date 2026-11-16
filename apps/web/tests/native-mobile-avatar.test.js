import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nativeAvatarRequest, encodeAvatarBase64, decodeAvatarBase64 } from "../src/lib/nativeAvatar.js";

const native = { isNativePlatform: () => true };
const token = "Bearer simulated.test.jwt";
const PNG_BYTES = Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0]);

test("native avatar encoding retains every byte and rejects excessive payloads", () => {
  const encoded = encodeAvatarBase64(PNG_BYTES);
  assert.deepEqual(decodeAvatarBase64(encoded), PNG_BYTES);
  assert.throws(() => decodeAvatarBase64("%%notbase64"), TypeError);
  assert.throws(() => encodeAvatarBase64(new Uint8Array(2 * 1024 * 1024 + 1)), TypeError);
});

test("native photo upload sends base64 bytes only to canonical endpoint with verified JWT", async () => {
  let options;
  const http = { request: async data => {
    options = data;
    return { status: 200, data: { key: "123" }, headers: { "content-type": "application/json" } };
  }};
  const result = await nativeAvatarRequest("/api/profile/avatar", {
    method: "PUT", body: new Blob([PNG_BYTES], { type: "image/png" }),
    headers: { authorization: token },
  }, { capacitor: native, http });
  assert.equal(options.url, "https://interplanetaryfund.com/api/profile/avatar");
  assert.equal(options.method, "PUT");
  assert.equal(options.dataType, "file");
  assert.equal(options.headers.authorization, token);
  assert.equal(options.headers["content-type"], "image/png");
  assert.equal(options.data, encodeAvatarBase64(PNG_BYTES));
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { key: "123" });
});

test("native avatar private reads decode bytes into an actual image response", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  let options;
  const response = await nativeAvatarRequest("/api/profile/avatar?id=" + id + "&key=" + id,
    { headers: { authorization: token } }, {
      capacitor: native,
      http: { request: async data => {
        options = data;
        return { status: 200, data: encodeAvatarBase64(PNG_BYTES),
          headers: { "content-type": "image/png", "cache-control": "private, no-store" } };
      }},
    });
  assert.equal(options.responseType, "arraybuffer");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal((await response.clone().blob()).type, "image/png");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), PNG_BYTES);
});

test("native profile-photo mutations reject wrong method, endpoint, unverified owner and oversized image", async () => {
  const never = { request: () => { throw new Error("Never call network for invalid request"); } };
  const api = { capacitor: native, http: never };
  await assert.rejects(() => nativeAvatarRequest("/api/payments/create-order",
    { method: "PUT", body: new Blob(["x"], { type: "image/png" }), headers: { authorization: token } }, api),
    TypeError);
  await assert.rejects(() => nativeAvatarRequest("/api/profile/avatar",
    { method: "PUT", body: new Blob(["x"], { type: "image/png" }) }, api), /Sign in/);
  await assert.rejects(() => nativeAvatarRequest("/api/profile/avatar",
    { method: "POST", headers: { authorization: token } }, api), TypeError);
  await assert.rejects(() => nativeAvatarRequest("/api/profile/avatar",
    { method: "PUT", headers: { authorization: token },
      body: new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], { type: "image/png" }) }, api), TypeError);
});

test("native photo deletion and provider error status remain authentic", async () => {
  const result = await nativeAvatarRequest("/api/profile/avatar", {
    method: "DELETE", headers: { authorization: token },
  }, { capacitor: native, http: {
    request: async () => ({ status: 204, data: null, headers: {} }),
  } });
  assert.equal(result.status, 204);
  const denied = await nativeAvatarRequest("/api/profile/avatar", {
    method: "GET", headers: { authorization: token },
  }, { capacitor: native, http: {
    request: async () => ({ status: 403, data: { error: "Forbidden" }, headers: { "content-type": "application/json" } }),
  } });
  assert.equal(denied.status, 403);
  assert.deepEqual(await denied.json(), { error: "Forbidden" });
});

test("profile-photo entrypoint selects native binary bridge without changing web request path", () => {
  const source = readFileSync(new URL("../src/lib/memberProfile.js", import.meta.url), "utf8");
  assert.match(source, /isNativeBundle\(\)/);
  assert.match(source, /nativeAvatarRequest\(url, request\)/);
  assert.match(source, /await fetch\(url, request\)/);
});
