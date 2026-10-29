import test from "node:test";
import assert from "node:assert/strict";
import { routeDeviceAuthorization } from "../../worker/deviceAuthorization.js";

const env = {
  MIGRATION_API_PREVIEW: "enabled",
  SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key",
  SUPABASE_SERVICE_ROLE_KEY: "server-only-test-service-role-secret",
  DEVICE_TOKEN_SECRET: "test-device-token-secret-with-at-least-32-characters",
};
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json" },
});
const request = (path, body, headers = {}) => new Request("https://interplanetaryfund.com" + path, {
  method: "POST",
  headers: { "content-type": "application/json", ...headers },
  body: JSON.stringify(body),
});

test("device authorization fails closed until the migration preview gate and secrets exist", async () => {
  const res = await routeDeviceAuthorization(request("/api/device-authorization/request", {}), {
    ...env, MIGRATION_API_PREVIEW: "disabled",
  }, async () => { throw new Error("must not access database"); });
  assert.equal(res.status, 503);
});

test("device request stores hashes only and returns a ten-minute code", async () => {
  let inserted;
  const fetcher = async (url, init = {}) => {
    if (String(url).includes("/rpc/ifund_device_rate_limit")) return json(true);
    if (String(url).includes("/rest/v1/ifund_device_authorizations") && init.method === "POST") {
      inserted = JSON.parse(init.body);
      return json([{ id: "c7c73f65-09a2-4b92-81d2-9b49f0ef5bb5" }], 201);
    }
    throw new Error("unexpected upstream request");
  };
  const res = await routeDeviceAuthorization(request("/api/device-authorization/request", {
    client_id: "ifund-device-v1",
    device_label: "Living room tablet",
    scopes: ["identity:read", "campaigns:read"],
  }, { "cf-connecting-ip": "192.0.2.10" }), env, fetcher);
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.match(body.device_code, /^[a-f0-9]{64}$/);
  assert.match(body.user_code, /^[A-HJ-NP-Z2-9]{8}$/);
  assert.equal(body.expires_in, 600);
  assert.equal(body.interval, 5);
  assert.equal(inserted.device_code_hash.length, 64);
  assert.equal(inserted.user_code_hash.length, 64);
  assert.equal(inserted.access_token_hash.length, 64);
  assert.equal("device_code" in inserted, false);
  assert.equal("user_code" in inserted, false);
  assert.equal("access_token" in inserted, false);
  assert.deepEqual(inserted.scopes, ["identity:read", "campaigns:read"]);
});

test("device request rejects unsupported scopes before writing a grant", async () => {
  let wrote = false;
  const fetcher = async (url, init = {}) => {
    if (String(url).includes("/rpc/ifund_device_rate_limit")) return json(true);
    if (String(url).includes("/rest/v1/ifund_device_authorizations") && init.method === "POST") wrote = true;
    throw new Error("unexpected upstream request");
  };
  const res = await routeDeviceAuthorization(request("/api/device-authorization/request", {
    client_id: "ifund-device-v1", device_label: "Unknown client",
    scopes: ["identity:read", "payments:write"],
  }), env, fetcher);
  assert.equal(res.status, 422);
  assert.equal(wrote, false);
});

test("approval cannot escalate beyond the scopes requested by the device", async () => {
  const id = "c7c73f65-09a2-4b92-81d2-9b49f0ef5bb5";
  const record = {
    id, user_code_hash: "a".repeat(64), state: "pending",
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    scopes: ["campaigns:read"], device_label: "Build agent", client_id: "ifund-agent-v1",
  };
  let patched = false;
  const fetcher = async (url, init = {}) => {
    const target = String(url);
    if (target.endsWith("/auth/v1/user")) return json({ id: "b7a2dd75-c4c1-4fb0-b91d-4e2b57a4f391" });
    if (target.includes("/rpc/ifund_device_rate_limit")) return json(true);
    if (target.includes("/rest/v1/ifund_device_authorizations?")) {
      if (init.method === "PATCH") patched = true;
      return json([record]);
    }
    throw new Error("unexpected upstream request: " + target);
  };
  const res = await routeDeviceAuthorization(request("/api/device-authorization/decide", {
    id, user_code: "ABCDEFG2", decision: "approve", scopes: ["identity:read"],
  }, { authorization: "Bearer verified-user-jwt" }), env, fetcher);
  assert.equal(res.status, 422);
  assert.equal(patched, false);
});
