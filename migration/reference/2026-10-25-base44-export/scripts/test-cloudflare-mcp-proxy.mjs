import assert from "node:assert/strict";
import worker from "../host/gateway/worker.js";

const originalFetch = globalThis.fetch;
try {
  let captured;
  globalThis.fetch = async (request) => {
    captured = {
      url: request.url,
      method: request.method,
      authorization: request.headers.get("authorization"),
      forwardedHost: request.headers.get("x-forwarded-host"),
      proxyMarker: request.headers.get("x-ifund-proxy"),
      body: request.method === "GET" || request.method === "HEAD" ? "" : await request.text(),
    };
    return new Response(JSON.stringify({ error: "authorization_required" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  };

  const health = await worker.fetch(new Request("https://interplanetaryfund.com/api/health"), {});
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("content-type"), "application/json");
  assert.deepEqual(await health.json(), {
    ok: true,
    service: "interplanetary-fund",
    runtime: "cloudflare-worker",
    mcp_proxy: "base44",
    status: "healthy",
  });
  assert.equal(captured, undefined, "health check must not depend on upstream Base44");

  const request = new Request("https://interplanetaryfund.com/api/mcp?probe=1", {
    method: "POST",
    headers: {
      authorization: "Bearer test-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: "probe", method: "initialize", params: {} }),
  });
  const response = await worker.fetch(request, { IFUND_BASE44_ORIGIN: "https://interplanetaryfund.base44.app" });

  assert.equal(response.status, 401);
  assert.equal(response.headers.get("x-ifund-mcp-proxy"), "base44");
  assert.equal(captured.url, "https://interplanetaryfund.base44.app/api/mcp?probe=1");
  assert.equal(captured.method, "POST");
  assert.equal(captured.authorization, "Bearer test-token");
  assert.equal(captured.forwardedHost, "interplanetaryfund.com");
  assert.equal(captured.proxyMarker, "cloudflare-mcp");
  assert.match(captured.body, /"initialize"/);

  captured = undefined;
  const discovery = await worker.fetch(new Request("https://interplanetaryfund.com/.well-known/oauth-protected-resource"), {});
  assert.equal(discovery.status, 401);
  assert.equal(captured.url, "https://interplanetaryfund.base44.app/.well-known/oauth-protected-resource");

  const admin = await worker.fetch(new Request("https://interplanetaryfund.com/v1/admin/agents/session", { method: "POST" }), {});
  assert.equal(admin.status, 403, "Admin gateway must retain its separate origin/admin authorization boundary");

  // Exercise the complete browser preflight and unauthenticated admin path,
  // not merely the Worker health endpoint. These must be true for all IFund
  // frontend origins without granting any admin privileges.
  const allowedOrigins = [
    "https://interplanetaryfund.com",
    "https://www.interplanetaryfund.com",
    "https://interplanetaryfund.base44.app",
    "https://interplanetary-fund2.interplanetary-fund.workers.dev",
  ];
  const gatewayEnv = { IFUND_ALLOWED_ORIGINS: allowedOrigins.join(",") };
  for (const origin of allowedOrigins) {
    const url = "https://interplanetary-fund2.interplanetary-fund.workers.dev/v1/admin/agents/session";
    const preflight = await worker.fetch(new Request(url, {
      method: "OPTIONS",
      headers: {
        origin,
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization,content-type",
      },
    }), gatewayEnv);
    assert.equal(preflight.status, 204, `Allowed origin ${origin} must pass preflight`);
    assert.equal(preflight.headers.get("access-control-allow-origin"), origin);
    assert.equal(preflight.headers.get("access-control-allow-credentials"), "true");
    assert.match(preflight.headers.get("access-control-allow-headers") || "", /authorization/);

    const blockedAdmin = await worker.fetch(new Request(url, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: "{}",
    }), gatewayEnv);
    assert.equal(blockedAdmin.status, 403, "No authentication must never grant admin access");
    assert.equal((await blockedAdmin.json()).error, "Administrator authorization required.");
    assert.equal(blockedAdmin.headers.get("access-control-allow-origin"), origin);
  }
  for (const origin of ["https://untrusted.example", "https://interplanetaryfund.com.evil.example"]) {
    const denied = await worker.fetch(new Request("https://interplanetaryfund.com/v1/admin/agents/session", {
      method: "OPTIONS", headers: { origin },
    }), gatewayEnv);
    assert.equal(denied.status, 403, `Untrusted origin ${origin} must be denied`);
    assert.equal(denied.headers.get("access-control-allow-origin"), null);
    assert.equal((await denied.json()).error, "Origin denied");
  }

  console.log("Cloudflare MCP proxy behavior passed.");
} finally {
  globalThis.fetch = originalFetch;
}
