import assert from "node:assert/strict";

const endpoint = "https://tzehxfikoslihnclhxuz.supabase.co/functions/v1/ifund-admin-mailbox";
const expected = [
  "https://interplanetaryfund.com",
  "https://www.interplanetaryfund.com",
  "https://interplanetaryfund.base44.app",
  "https://interplanetary-fund2.interplanetary-fund.workers.dev",
];
const forbidden = [
  "https://untrusted.invalid",
  "https://crowdfund.base44.app",
  "https://ifund2.base44.app",
];
const strict = process.env.IFUND_EXPECT_MAILBOX_CORS_LIVE === "1";

async function preflight(origin) {
  const response = await fetch(endpoint, {
    method: "OPTIONS",
    headers: { Origin: origin, "Access-Control-Request-Method": "GET" },
    signal: AbortSignal.timeout(12000),
  });
  return { status: response.status, allowOrigin: response.headers.get("access-control-allow-origin") };
}

for (const origin of expected) {
  const result = await preflight(origin);
  if (strict) {
    assert.equal(result.status, 204, `Expected allowed preflight for ${origin}`);
    assert.equal(result.allowOrigin, origin, `Expected exact origin for ${origin}`);
  }
  console.log(`${origin}: HTTP ${result.status}, allow-origin=${result.allowOrigin || "(none)"}`);
}

for (const origin of forbidden) {
  const denied = await preflight(origin);
  if (origin === "https://untrusted.invalid" || strict) {
    assert.equal(denied.status, 403, `Origin must be denied: ${origin}`);
    assert.notEqual(denied.allowOrigin, origin, `Never grant origin: ${origin}`);
  }
  console.log(`${origin}: HTTP ${denied.status}, allow-origin=${denied.allowOrigin || "(none)"}${!strict && denied.status !== 403 ? " (legacy origin still allowed)" : ""}`);
}

const unauthenticated = await fetch(endpoint, {
  headers: { Origin: expected[0] },
  signal: AbortSignal.timeout(12000),
});
assert.equal(unauthenticated.status, 401, "Mailbox must require authentication");
assert.equal(unauthenticated.headers.get("cache-control"), "no-store", "Mailbox must not cache private responses");
console.log("PASS: untrusted origins denied; unauthenticated mailbox denied; private response not cached.");
if (!strict) console.log("Live exact-origin CORS acceptance and legacy-origin rejection are observational until IFUND_EXPECT_MAILBOX_CORS_LIVE=1.");
