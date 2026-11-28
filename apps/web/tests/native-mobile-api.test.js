import test from "node:test";
import assert from "node:assert/strict";
import { canonicalApiPath, canonicalApiUrl, IFUND_API_ORIGIN, ifundApiFetch,
  installNativeApiTransport, isNativeBundle, authEmailRedirectOrigin, shareWithDevice } from "../src/lib/nativeApi.js";

const native = { isNativePlatform: () => true };
const web = { isNativePlatform: () => false };

test("canonical API URL refuses hostile URLs, traversal and non-API paths", () => {
  assert.equal(IFUND_API_ORIGIN, "https://interplanetaryfund.com");
  assert.equal(canonicalApiUrl("/api/health?check=1"), IFUND_API_ORIGIN + "/api/health?check=1");
  assert.equal(canonicalApiPath("/api/payments/config"), "/api/payments/config");
  for (const value of ["", "/api", "/", "/campaign/123", "//evil.example/api/payments",
    "https://evil.example/api/payments", "javascript:evil", "/api/../admin",
    "/api/%2e%2e/secret", "/api/health\\\\evil"]) {
    assert.throws(() => canonicalApiUrl(value), TypeError, String(value));
  }
});

test("web calls stay same-origin and do not use native HTTP", async () => {
  assert.equal(isNativeBundle(web), false);
  let path = "";
  const response = await ifundApiFetch("/api/health", { cache: "no-store" }, {
    capacitor: web,
    fetch: async (url) => { path = url; return new Response("web", { status: 200 }); },
    http: { request: () => { throw new Error("Native API must not run on the website"); } },
  });
  assert.equal(path, "/api/health");
  assert.equal(await response.text(), "web");
});

test("bundled mobile calls reach canonical API with existing JWT headers", async () => {
  let captured;
  const http = { request: async (request) => {
    captured = request;
    return { status: 200, data: { ok: true, id: "verified" }, headers: { "content-type": "application/json" } };
  }};
  const response = await ifundApiFetch("/api/campaigns/mine", {
    method: "POST",
    headers: { Authorization: "Bearer verified-session", "Content-Type": "application/json" },
    body: JSON.stringify({ cursor: 3 }),
  }, {
    capacitor: native,
    http,
    fetch: () => { throw new Error("Must not fallback to browser fetch"); },
  });
  assert.equal(captured.url, IFUND_API_ORIGIN + "/api/campaigns/mine");
  assert.equal(captured.method, "POST");
  assert.equal(captured.headers.authorization, "Bearer verified-session");
  assert.deepEqual(captured.data, { cursor: 3 });
  assert.equal(response.ok, true);
  assert.deepEqual(await response.json(), { ok: true, id: "verified" });
});

test("native API failure never silently falls back, and preserves real HTTP errors", async () => {
  const fail = () => { throw new Error("Network unavailable"); };
  await assert.rejects(() => ifundApiFetch("/api/health", {}, {
    capacitor: native, http: { request: fail }, fetch: () => new Response("cached"),
  }), /Network unavailable/);
  const response = await ifundApiFetch("/api/account/me", {}, {
    capacitor: native, http: { request: async () => ({
      status: 403, data: { error: "Access denied" }, headers: {},
    }) },
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Access denied" });
});

test("native requests fail closed for invalid body, method and already-aborted signal", async () => {
  const http = { request: async () => ({ status: 200, data: {} }) };
  const adapters = { capacitor: native, http };
  await assert.rejects(() => ifundApiFetch("/api/x", { method: "TRACE" }, adapters), TypeError);
  await assert.rejects(() => ifundApiFetch("/api/x", { method: "POST", body: "text" }, adapters), TypeError);
  await assert.rejects(() => ifundApiFetch("/api/x", { method: "POST", headers: {
    "content-type": "application/json" }, body: "not json" }, adapters), TypeError);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(() => ifundApiFetch("/api/x", { signal: controller.signal }, adapters),
    { name: "AbortError" });
});

test("native-only scoped installation intercepts /api but leaves Supabase and assets alone", async () => {
  const seen = [];
  const webFetch = async (url) => { seen.push(url); return new Response("web"); };
  const target = { location: { hostname: "localhost" }, fetch: webFetch };
  const intercepted = [];
  const success = installNativeApiTransport(target, {
    capacitor: native,
    http: { request: async ({ url }) => {
      intercepted.push(url);
      return { status: 200, data: { live: true }, headers: {} };
    }},
  });
  assert.equal(success, true);
  assert.deepEqual(await (await target.fetch("/api/health")).json(), { live: true });
  await target.fetch("https://ssibsfmtodgximseeqsv.supabase.co/rest/v1/ifund_campaigns");
  await target.fetch("/icon-192.png");
  assert.deepEqual(intercepted, [IFUND_API_ORIGIN + "/api/health"]);
  assert.deepEqual(seen, [
    "https://ssibsfmtodgximseeqsv.supabase.co/rest/v1/ifund_campaigns",
    "/icon-192.png",
  ]);
});

test("native confirmation and recovery return to the same verified HTTPS account", () => {
  assert.equal(authEmailRedirectOrigin("capacitor://localhost", native), IFUND_API_ORIGIN);
  assert.equal(authEmailRedirectOrigin("https://localhost", native), IFUND_API_ORIGIN);
  assert.equal(authEmailRedirectOrigin("http://localhost:5173", web), "http://localhost:5173");
});

test("native API callers can stop waiting for an in-flight request", async () => {
  const controller = new AbortController();
  let resolveRequest;
  const http = { request: () => new Promise(resolve => { resolveRequest = resolve; }) };
  const pending = ifundApiFetch("/api/health", { signal: controller.signal },
    { capacitor: native, http });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  // The native socket may still finish; a late result must not report success.
  resolveRequest({ status: 200, data: { ok: true }, headers: {} });
});

test("native system sharing rejects off-site and local WebView URLs", async () => {
  let shared;
  const nativeShare = { share: async args => { shared = args; return {}; } };
  await shareWithDevice({ title: "Campaign", text: "Help", url: IFUND_API_ORIGIN + "/campaign/123" },
    { capacitor: native, nativeShare });
  assert.deepEqual(shared, { title: "Campaign", text: "Help", url: IFUND_API_ORIGIN + "/campaign/123" });
  await assert.rejects(() => shareWithDevice({ url: "http://localhost:5173/campaign/123" },
    { capacitor: native, nativeShare }), TypeError);
  await assert.rejects(() => shareWithDevice({ url: "https://fraud.invalid/phishing" },
    { capacitor: native, nativeShare }), TypeError);
  for (const bad of [
    IFUND_API_ORIGIN + "/campaign/123?token_hash=secret",
    IFUND_API_ORIGIN + "/campaign/123#access_token=secret",
  ]) {
    await assert.rejects(() => shareWithDevice({ url: bad },
      { capacitor: native, nativeShare }), TypeError);
  }
});

test("web preview sharing remains available without weakening native URL restrictions", async () => {
  let delivered;
  const navigatorLike = { share: async payload => { delivered = payload; } };
  await shareWithDevice({ url: "https://preview.example.dev/campaign/123", title: "Preview" }, {
    capacitor: web,
    navigatorLike,
  });
  assert.equal(delivered.url, "https://preview.example.dev/campaign/123");
  await assert.rejects(() => shareWithDevice({ url: "https://preview.example.dev/campaign/123" }, {
    capacitor: native,
    nativeShare: { share: async () => { throw new Error("Must not be called"); } },
  }), TypeError);
});

test("unapproved native payment writes fail closed before contacting providers", async () => {
  let called = 0;
  const http = { request: async () => { called++; return { status: 200, data: {} }; } };
  for (const path of ["/api/payments/create-order", "/api/payments/capture-order",
    "/api/payments/subscriptions/start", "/api/payments/subscriptions/confirm"]) {
    const response = await ifundApiFetch(path, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    }, { capacitor: native, http });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error, "native_checkout_requires_approval");
  }
  assert.equal(called, 0);
});
