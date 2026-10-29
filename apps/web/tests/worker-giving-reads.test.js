import test from "node:test";
import assert from "node:assert/strict";
import { routeGivingRead } from "../../worker/givingReads.js";

const uid = "b7a2dd75-c4c1-4fb0-b91d-4e2b57a4f391";
const campaignId = "c7c73f65-09a2-4b92-81d2-9b49f0ef5bb5";
const donationId = "d7c73f65-09a2-4b92-81d2-9b49f0ef5bb5";
const env = {
  MIGRATION_API_PREVIEW: "enabled",
  SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key",
  SUPABASE_SERVICE_ROLE_KEY: "server-only-test-service-role-secret",
};
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json" },
});
const req = () => new Request("https://interplanetaryfund.com/api/giving/mine", {
  method: "GET", headers: { authorization: "Bearer verified-user-jwt" },
});
const captured = {
  id: donationId, donor_id: uid, campaign_id: campaignId,
  gift_cents: 2500, optional_support_cents: 250, currency: "USD",
  status: "captured", created_at: "2026-10-01T12:00:00.000Z",
  captured_at: "2026-10-01T12:01:00.000Z",
};

test("giving history returns only confirmed gift and separately recorded optional support", async () => {
  const fetcher = async (url) => {
    const target = String(url);
    if (target.endsWith("/auth/v1/user")) return json({ id: uid });
    if (target.includes("/rest/v1/ifund_profiles?")) return json([{ id: uid }]);
    if (target.includes("/rest/v1/ifund_donations?")) {
      assert.ok(target.includes("donor_id=eq." + uid));
      assert.ok(target.includes("status=eq.captured"));
      return json([captured]);
    }
    if (target.includes("/rest/v1/ifund_campaigns?")) return json([{ id: campaignId, title: "Repair the community garden" }]);
    throw new Error("unexpected upstream request: " + target);
  };
  const res = await routeGivingRead(req(), env, fetcher);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.donations.length, 1);
  assert.equal(body.donations[0].amount, 25);
  assert.equal(body.donations[0].platform_support_amount, 2.5);
  assert.equal(body.donations[0].campaign_title, "Repair the community garden");
  assert.equal(body.donations[0].payment_method, "PayPal");
  assert.equal("paypal_order_id" in body.donations[0], false);
  assert.equal("paypal_capture_id" in body.donations[0], false);
  assert.equal("total_charged" in body.donations[0], false);
});

test("giving history fails closed if a returned row crosses donor ownership", async () => {
  const fetcher = async (url) => {
    const target = String(url);
    if (target.endsWith("/auth/v1/user")) return json({ id: uid });
    if (target.includes("/rest/v1/ifund_profiles?")) return json([{ id: uid }]);
    if (target.includes("/rest/v1/ifund_donations?")) return json([{ ...captured, donor_id: "a7a2dd75-c4c1-4fb0-b91d-4e2b57a4f391" }]);
    throw new Error("unexpected upstream request: " + target);
  };
  const res = await routeGivingRead(req(), env, fetcher);
  assert.equal(res.status, 503);
});
