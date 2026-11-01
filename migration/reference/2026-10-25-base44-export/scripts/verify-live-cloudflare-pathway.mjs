// Non-mutating end-to-end verification for the deployed Cloudflare Worker and
// the public IFund hostname. A 200 HTML SPA is never proof of a Worker route.
import assert from "node:assert/strict";

const directWorker = String(process.env.IFUND_WORKER_URL || "https://interplanetary-fund2.interplanetary-fund.workers.dev").replace(/\/$/, "");
const production = "https://interplanetaryfund.com";
const www = "https://www.interplanetaryfund.com";
const expectedOrigins = [
  "https://interplanetaryfund.com",
  "https://www.interplanetaryfund.com",
  "https://interplanetaryfund.base44.app",
  "https://interplanetary-fund2.interplanetary-fund.workers.dev",
];

async function probe(site, label) {
  const health = await fetch(site + "/api/health", {
    headers: { "cache-control": "no-cache" }, redirect: "manual",
  });
  const contentType = health.headers.get("content-type") || "";
  assert.equal(health.status, 200, `${label}: /api/health HTTP ${health.status}; check DNS/route`);
  assert.match(contentType, /application\/json/i,
    `${label}: /api/health is not Worker JSON (got ${contentType}); check proxied DNS and route`);
  const body = await health.json();
  assert.equal(body?.runtime, "cloudflare-worker", `${label}: /api/health reached the wrong origin`);
  assert.equal(body?.ok, true);

  const mcp = await fetch(site + "/api/mcp", { redirect: "manual" });
  assert.equal(mcp.headers.get("x-ifund-mcp-proxy"), "base44",
    `${label}: /api/mcp did not traverse the Cloudflare Worker proxy`);
  assert.ok([401, 403].includes(mcp.status), `${label}: unauthenticated MCP unexpectedly returned ${mcp.status}`);

  const sessionUrl = site + "/v1/admin/agents/session";
  for (const origin of expectedOrigins) {
    const preflight = await fetch(sessionUrl, {
      method: "OPTIONS", redirect: "manual",
      headers: {
        origin,
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization,content-type",
      },
    });
    assert.equal(preflight.status, 204,
      `${label}: allowed origin ${origin} preflight HTTP ${preflight.status}`);
    assert.equal(preflight.headers.get("access-control-allow-origin"), origin,
      `${label}: missing CORS allow-origin for ${origin}`);

    const unauthorized = await fetch(sessionUrl, {
      method: "POST", redirect: "manual",
      headers: { origin, "content-type": "application/json" }, body: "{}",
    });
    assert.equal(unauthorized.status, 403, `${label}: admin route failed closed to anonymous request`);
    assert.equal(unauthorized.headers.get("access-control-allow-origin"), origin,
      `${label}: admin response lost browser CORS headers for ${origin}`);
    assert.equal((await unauthorized.json()).error, "Administrator authorization required.",
      `${label}: origin was denied or request never reached the authenticated admin boundary`);
  }
  const stranger = await fetch(sessionUrl, {
    method: "OPTIONS", redirect: "manual",
    headers: { origin: "https://untrusted.example", "access-control-request-method": "POST" },
  });
  assert.equal(stranger.status, 403, `${label}: untrusted origin was not blocked`);
  assert.equal(stranger.headers.get("access-control-allow-origin"), null,
    `${label}: untrusted origin received credentialed CORS headers`);

  console.log(`PASS ${label}: health JSON, MCP, CORS preflight, admin auth boundary and origin denial`);
}

await probe(directWorker, "workers.dev");
await probe(production, "interplanetaryfund.com");
await probe(www, "www.interplanetaryfund.com");

// A matching Worker health result alone does not prove website release
// parity. The Base44 source of record and the public host must identify the
// same approved web build. Native APK compilation and signing can run by
// explicit owner request through Base44 or the manual-only GitHub workflow;
// neither path is an automatic web-deployment prerequisite.
const releaseSources = [
  ["Cloudflare Worker", directWorker],
  ["IFund apex", production],
  ["IFund www", www],
  ["Base44 app", "https://interplanetaryfund.base44.app"],
];
const releases = [];
for (const [name, host] of releaseSources) {
  const response = await fetch(host + "/ifund-release.json", { cache: "no-store" });
  assert.equal(response.status, 200, `${name}: missing release marker`);
  assert.ok((response.headers.get("content-type") || "").includes("application/json"), `${name}: invalid release marker MIME type`);
  const record = await response.json();
  assert.ok(record.release_id, `${name}: empty release identifier`);
  releases.push(record.release_id);
}
assert.equal(new Set(releases).size, 1,
  `IFund site/Worker/Base44 release mismatch: ${releaseSources.map(([name],i) => name + "=" + releases[i]).join("; ")}`);
console.log("PASS: Cloudflare, custom domain, www, and Base44 release identifiers agree.");
console.log("PASS: full IFund Cloudflare gateway routing is live across all public hostnames.");
