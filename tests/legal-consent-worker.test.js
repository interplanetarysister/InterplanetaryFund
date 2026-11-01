import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CURRENT_TERMS_VERSION, verifyLegalConsent } from "../worker/legalConsent.js";
import { routeCampaignWrite } from "../worker/campaignWrites.js";

const uid = "a09c3b82-1758-454d-912c-e69ea4136daa";
const env = { MIGRATION_API_PREVIEW: "enabled",
  SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_only" };
const account = { uid, jwt: "signed.test.jwt" };
const accepted = { owner_id: uid, terms_version: CURRENT_TERMS_VERSION,
  explicit_consent: true, accepted_at: "2026-10-30T00:00:00Z" };
const legalSource = readFileSync(new URL("../apps/web/src/lib/legalPolicy.js", import.meta.url), "utf8");

test("worker and web agree on the current immutable Terms version", () => {
  assert.match(legalSource, new RegExp('TERMS_VERSION\\s*=\\s*"' + CURRENT_TERMS_VERSION + '"'));
});
test("legal verification queries only current JWT owner and version, never service role", async () => {
  const calls = [];
  const denied = await verifyLegalConsent(account, env, async (url, options) => {
    calls.push({ url: String(url), options });
    return Response.json([accepted]);
  });
  assert.equal(denied, null);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.includes("owner_id=eq." + uid));
  assert.ok(calls[0].url.includes("terms_version=eq." + CURRENT_TERMS_VERSION));
  assert.equal(calls[0].options.headers.Authorization, "Bearer signed.test.jwt");
  assert.equal(calls[0].options.headers.apikey, env.SUPABASE_PUBLISHABLE_KEY);
});
test("missing, stale, mismatched, and malformed consent all fail closed", async () => {
  for (const rows of [[], [{ ...accepted, explicit_consent: false }],
    [{ ...accepted, terms_version: "2025-old" }],
    [{ ...accepted, owner_id: "9baa21da-845b-46d9-9476-a41c38564756" }],
    [{ ...accepted, accepted_at: null }], [accepted, accepted], { invalid: true }]) {
    const denied = await verifyLegalConsent(account, env, async () => Response.json(rows));
    assert.ok(denied && [403, 503].includes(denied.status), JSON.stringify(rows));
  }
  const error = await verifyLegalConsent(account, env, async () =>
    new Response("private-provider-error", { status: 500 }));
  assert.equal(error.status, 503);
  assert.doesNotMatch(error.error, /private-provider-error/);
});
test("direct campaign POST cannot bypass the UI Terms gate", async () => {
  const calls = [];
  const req = new Request("https://ifund.example/api/campaigns", {
    method: "POST", headers: { authorization: "Bearer signed.test.jwt", "content-type": "application/json" },
    body: JSON.stringify({ title: "A draft" }),
  });
  const res = await routeCampaignWrite(req, env, async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith("/auth/v1/user"))
      return Response.json({ id: uid, email_confirmed_at: "2026-10-30T00:00:00Z" });
    if (String(url).includes("account_status"))
      return Response.json([{ id: uid, account_status: "active", account_deletion_pending: false }]);
    if (String(url).includes("ifund_legal_acceptances?")) return Response.json([]);
    throw new Error("Campaign mutation must not be attempted");
  });
  assert.equal(res.status, 403);
  assert.equal(calls.length, 3);
  assert.ok(calls.every(call => call.options.method === "GET" || !call.options.method));
});
