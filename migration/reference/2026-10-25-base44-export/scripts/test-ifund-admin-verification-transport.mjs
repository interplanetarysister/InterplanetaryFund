import assert from "node:assert/strict";
import gateway from "../host/gateway/worker.js";

const base = "https://interplanetary-fund2.interplanetary-fund.workers.dev";
const origin = "https://interplanetaryfund.com";
const baseEnv = {
  IFUND_ALLOWED_ORIGINS: origin,
  IFUND_ADMIN_VERIFY_URL: "https://trusted.example/verify",
  IFUND_ADMIN_AGENT_KEY: "test-admin-key",
  IFUND_SESSION_SECRET: "test-session-secret",
};
const originalFetch = globalThis.fetch;
const request = () => new Request(base + "/v1/admin/agents/session", {
  method: "POST",
  headers: { origin, authorization: "Bearer test-session", "content-type": "application/json" },
  body: JSON.stringify({ adminKey: "test-admin-key" }),
});
async function run(env, responder) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return responder(url, options);
  };
  try {
    const response = await gateway.fetch(request(), { ...baseEnv, ...env });
    return { response, calls };
  } finally {
    globalThis.fetch = originalFetch;
  }
}
const denied = async (env, responder) => {
  const { response, calls } = await run(env, responder);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "Administrator authorization required.");
  return calls;
};
try {
  for (const url of ["http://trusted.example/verify", "https://user:pass@trusted.example/verify", "not-a-url"]) {
    const calls = await denied({ IFUND_ADMIN_VERIFY_URL: url }, () => { throw Error("must not fetch"); });
    assert.equal(calls.length, 0, "unsafe verification endpoint must not receive credentials");
  }
  const redirected = await denied({}, () => new Response(null, {
    status: 302, headers: { location: "https://untrusted.example/collect" }
  }));
  assert.equal(redirected.length, 1);
  assert.equal(redirected[0].options.redirect, "manual", "verification must not follow redirects");
  assert.equal(redirected[0].options.method, "GET");
  assert.equal(redirected[0].options.cache, "no-store");
  assert.equal(redirected[0].options.headers.authorization, "Bearer test-session");

  await denied({}, () => new Response("not json", { status: 200 }));
  await denied({}, () => Response.json({ role: "admin", super_admin: true }));
  await denied({}, () => Response.json({ id: "owner", role: "admin", super_admin: false }));
  await denied({}, () => { throw Error("provider offline"); });

  const success = await run({}, () => Response.json({ id: "verified-owner", role: "admin", super_admin: true }));
  assert.equal(success.response.status, 200);
  const body = await success.response.json();
  assert.equal(typeof body.sessionId, "string");
  assert.equal(body.expiresIn, 900);
  assert.ok(!JSON.stringify(body).includes("test-admin-key"));
  console.log("PASS: admin verification only forwards credentials to HTTPS without redirects; malformed identities fail closed.");
} finally {
  globalThis.fetch = originalFetch;
}
