import test from "node:test";
import assert from "node:assert/strict";
import { ApiError, createApiClient, resolveApiUrl } from "../src/lib/api.js";

test("uses same-origin /api routes when no API origin is configured", () => {
  assert.equal(resolveApiUrl("/api/account/me", ""), "/api/account/me");
});

test("supports a replaceable HTTPS API origin and path prefix", () => {
  assert.equal(
    resolveApiUrl("/api/account/me", "https://api.example.com/ifund"),
    "https://api.example.com/ifund/api/account/me",
  );
});

test("rejects vendor-specific or malformed URL assumptions", () => {
  assert.throws(() => resolveApiUrl("/account/me", ""), /absolute \/api\//);
  assert.throws(() => resolveApiUrl("/api/account/me", "not a URL"), /valid absolute URL/);
  assert.throws(() => resolveApiUrl("/api/account/me", "http://api.example.com"), /HTTPS/);
  assert.throws(() => resolveApiUrl("/api/account/me", "https://user:pass@api.example.com"), /credentials/);
});

test("sends a Supabase bearer token and JSON request body", async () => {
  let captured;
  const client = createApiClient({
    baseUrl: "https://api.example.com",
    getAccessToken: async () => "supabase-user-jwt",
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const result = await client.request("/api/campaigns", {
    method: "POST",
    body: { title: "Test" },
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(captured.url, "https://api.example.com/api/campaigns");
  assert.equal(captured.options.headers.get("authorization"), "Bearer supabase-user-jwt");
  assert.equal(captured.options.headers.get("content-type"), "application/json");
  assert.deepEqual(JSON.parse(captured.options.body), { title: "Test" });
});

test("returns structured errors without losing HTTP status", async () => {
  const client = createApiClient({
    getAccessToken: async () => null,
    fetchImpl: async () => new Response(JSON.stringify({ error: "Forbidden", code: "forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    }),
  });
  await assert.rejects(
    client.request("/api/account/me"),
    (error) => error instanceof ApiError && error.status === 403 && error.code === "forbidden",
  );
});
