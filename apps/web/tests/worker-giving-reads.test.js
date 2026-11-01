import test from "node:test";
import assert from "node:assert/strict";
import { routeGivingRead } from "../../../worker/givingReads.js";

const uid = "b7a2dd75-c4c1-4fb0-b91d-4e2b57a4f391";
const campaignId = "c7c73f65-09a2-4b92-81d2-9b49f0ef5bb5";
const donationId = "d7c73f65-09a2-4b92-81d2-9b49f0ef5bb5";
const env = {
  MIGRATION_API_PREVIEW: "enabled",
  SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key",
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
  status: "captured", captured_at: "2026-10-01T12:01:00.000Z",
};

function upstreamFor(rows) {
  return async (url, init = {}) => {
    const target = String(url);
    if (target.endsWith("/auth/v1/user")) return json({ id: uid, email_confirmed_at: "2026-10-01T00:00:00.000Z" });
    if (target.includes("/rest/v1/ifund_profiles?")) {
      assert.equal(init.headers.Authorization, "Bearer verified-user-jwt");
      return json([{ id: uid, account_status: "active", account_deletion_pending: false }]);
    }
    if (target.includes("/rest/v1/ifund_donations?")) {
      assert.equal(init.headers.apikey, env.SUPABASE_PUBLISHABLE_KEY);
      assert.equal(init.headers.Authorization, "Bearer verified-user-jwt");
      assert.ok(target.includes("donor_id=eq." + uid));
      assert.ok(target.includes("status=eq.captured"));
      assert.ok(!target.includes("paypal_order_id"));
      assert.ok(!target.includes("paypal_capture_id"));
      return json(rows);
    }
    if (target.includes("/rest/v1/ifund_campaigns?")) {
      assert.equal(init.headers.Authorization, "Bearer verified-user-jwt");
      return json([{ id: campaignId, title: "Repair the community garden" }]);
    }
    throw new Error("unexpected upstream request: " + target);
  };
}

test("giving history uses the donor JWT and returns confirmed gift/support amounts", async () => {
  const res = await routeGivingRead(req(), env, upstreamFor([captured]));
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
  const otherDonor = "a7a2dd75-c4c1-4fb0-b91d-4e2b57a4f391";
  const res = await routeGivingRead(req(), env, upstreamFor([{ ...captured, donor_id: otherDonor }]));
  assert.equal(res.status, 503);
});

test("giving history does not require a service-role key", async () => {
  const res = await routeGivingRead(req(), env, upstreamFor([]));
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).donations, []);
});
