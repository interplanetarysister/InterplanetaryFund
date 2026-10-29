import test from "node:test";
import assert from "node:assert/strict";
import { routeDeviceAuthorization } from "../../../worker/deviceAuthorization.js";

const env = {
  MIGRATION_API_PREVIEW: "enabled",
  SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key",
  SUPABASE_SERVICE_ROLE_KEY: "server-only-test-service-role-secret",
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
    if (String(url).includes("/rest/v1/ifund_device_authorizations?")) return json([]);
    if (String(url).endsWith("/rest/v1/ifund_device_authorizations") && init.method === "POST") {
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
  assert.match(body.user_code, /^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
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

test("approval cannot add scopes that the device did not request", async () => {
  const id = "c7c73f65-09a2-4b92-81d2-9b49f0ef5bb5";
  const record = {
    id, user_code_hash: "a".repeat(64), state: "pending",
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    scopes: ["campaigns:read"], device_label: "Build agent", client_id: "ifund-agent-v1",
  };
  let patchBody;
  const fetcher = async (url, init = {}) => {
    const target = String(url);
    if (target.endsWith("/auth/v1/user")) return json({ id: "b7a2dd75-c4c1-4fb0-b91d-4e2b57a4f391", email_confirmed_at: "2026-10-01T00:00:00.000Z" });
    if (target.includes("/rest/v1/ifund_profiles?")) return json([{ id: "b7a2dd75-c4c1-4fb0-b91d-4e2b57a4f391" }]);
    if (target.includes("/rpc/ifund_device_rate_limit")) return json(true);
    if (target.includes("/rest/v1/ifund_device_authorizations?")) {
      if (init.method === "PATCH") { patchBody = JSON.parse(init.body); return json([{ ...record, ...patchBody }]); }
      return json([record]);
    }
    throw new Error("unexpected upstream request: " + target);
  };
  const res = await routeDeviceAuthorization(request("/api/device-authorization/decide", {
    user_code: "ABCDE-FG234", decision: "approve", scopes: ["identity:read"],
  }, { authorization: "Bearer verified-user-jwt" }), env, fetcher);
  assert.equal(res.status, 200);
  assert.equal(patchBody.state, "approved");
  assert.equal("scopes" in patchBody, false);
});


test("revoked device grants cannot read resources", async () => {
  const token = "ifd_at_" + "a".repeat(64);
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("ifund:access-hash:v1:" + token));
  const tokenHash = [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, "0")).join("");
  const record = {
    id: "c7c73f65-09a2-4b92-81d2-9b49f0ef5bb5",
    access_token_hash: tokenHash, state: "revoked",
    owner_id: "b7a2dd75-c4c1-4fb0-b91d-4e2b57a4f391",
    grant_expires_at: new Date(Date.now() + 60_000).toISOString(),
    scopes: ["identity:read"],
  };
  let profileRead = false;
  const fetcher = async (url, init = {}) => {
    const target = String(url);
    if (target.includes("/rpc/ifund_device_rate_limit")) return json(true);
    if (target.includes("/rest/v1/ifund_device_authorizations?")) return json([record]);
    if (target.includes("/rest/v1/ifund_profiles?")) { profileRead = true; return json([]); }
    throw new Error("unexpected upstream request: " + target);
  };
  const res = await routeDeviceAuthorization(request("/api/device-authorization/resource", {
    action: "identity",
  }, { "x-ifund-device-token": token }), env, fetcher);
  assert.equal(res.status, 401);
  assert.equal(profileRead, false);
});


test("approved device reads only the identity fields its grant permits", async () => {
  const token = "ifd_at_" + "b".repeat(64);
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("ifund:access-hash:v1:" + token));
  const tokenHash = [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, "0")).join("");
  const record = {
    id: "c7c73f65-09a2-4b92-81d2-9b49f0ef5bb5",
    access_token_hash: tokenHash, state: "approved",
    owner_id: "b7a2dd75-c4c1-4fb0-b91d-4e2b57a4f391",
    grant_expires_at: new Date(Date.now() + 60_000).toISOString(),
    scopes: ["identity:read"],
  };
  const fetcher = async (url, init = {}) => {
    const target = String(url);
    if (target.includes("/rpc/ifund_device_rate_limit")) return json(true);
    if (target.includes("/rest/v1/ifund_device_authorizations?")) return json([record]);
    if (target.includes("/rest/v1/ifund_profiles?")) {
      return json([{ id: record.owner_id, handle: "test-handle", display_name: "Test Display" }]);
    }
    throw new Error("unexpected upstream request: " + target);
  };
  const res = await routeDeviceAuthorization(request("/api/device-authorization/resource", {
    action: "identity",
  }, { "x-ifund-device-token": token }), env, fetcher);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.identity, {
    id: record.owner_id, username: "test-handle", display_name: "Test Display",
  });
  const forbidden = await routeDeviceAuthorization(request("/api/device-authorization/resource", {
    action: "campaigns",
  }, { "x-ifund-device-token": token }), env, fetcher);
  assert.equal(forbidden.status, 403);
});


test("approved device-code exchange returns only the scoped bearer format", async () => {
  const deviceCode = "d".repeat(64);
  const digest = async value => {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, "0")).join("");
  };
  const token = "ifd_at_" + await digest("ifund:access-token:v1:" + deviceCode);
  const record = {
    id: "c7c73f65-09a2-4b92-81d2-9b49f0ef5bb5",
    device_code_hash: await digest("ifund:device-code:v1:" + deviceCode),
    access_token_hash: await digest("ifund:access-hash:v1:" + token),
    state: "approved", owner_id: "b7a2dd75-c4c1-4fb0-b91d-4e2b57a4f391",
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    grant_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    scopes: ["identity:read"],
  };
  const fetcher = async (url) => {
    const target = String(url);
    if (target.includes("/rpc/ifund_device_rate_limit")) return json(true);
    if (target.includes("/rest/v1/ifund_device_authorizations?")) return json([record]);
    throw new Error("unexpected upstream request: " + target);
  };
  const res = await routeDeviceAuthorization(request("/api/device-authorization/token", {
    grant_type: "urn:ietf:params:oauth:grant-type:device_code", device_code: deviceCode,
  }), env, fetcher);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.access_token, token);
  assert.equal(body.token_type, "Bearer");
  assert.equal(body.scope, "identity:read");
  assert.ok(body.expires_in > 0);
});
