import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  IFUND_PLATFORM_SUPPORT_PAYMENT_LINK,
  generatePayPalLink,
  generateDonationBlock,
  campaignDonateUrl,
} from "../src/lib/paypalLink.js";
import {
  classifyPayPalEvent,
  PLATFORM_SUPPORT_MARKER,
  verifyPayPalWebhook,
  missingPayPalWebhookConfig,
  paypalApiBase,
  handlePayPalWebhook,
  recordPlatformSupportPayment,
} from "../worker/paypalWebhook.js";

const capture = (overrides = {}) => ({
  id: "WH-1",
  event_type: "PAYMENT.CAPTURE.COMPLETED",
  resource: {
    id: "CAP123",
    custom_id: PLATFORM_SUPPORT_MARKER,
    status: "COMPLETED",
    amount: { currency_code: "USD", value: "25.00" },
    seller_receivable_breakdown: {
      paypal_fee: { value: "1.36" },
      net_amount: { value: "23.64" },
    },
    supplementary_data: { related_ids: { order_id: "ORD1" } },
    create_time: "2026-10-24T20:00:00Z",
  },
  ...overrides,
});

test("platform-support link is the hosted IFund link with no extra params", () => {
  assert.equal(generatePayPalLink(), IFUND_PLATFORM_SUPPORT_PAYMENT_LINK);
  assert.match(generateDonationBlock("x", true), /not the individual campaign/);
  assert.equal(campaignDonateUrl("a b"), "https://interplanetaryfund.com/campaign/a%20b?donate=true");
});

test("no Base44 references in ported payment files", () => {
  for (const f of ["src/lib/paypalLink.js", "src/components/payments/PayPalDonateButton.jsx", "worker/paypalWebhook.js"]) {
    assert.doesNotMatch(readFileSync(f, "utf8"), /@base44|base44:runtime|base44\.app/);
  }
});

test("classifies a completed platform-support capture", () => {
  const r = classifyPayPalEvent(capture());
  assert.equal(r.kind, "platform_support");
  assert.equal(r.record.paypal_capture_id, "CAP123");
  assert.equal(r.record.gross_amount, 25);
  assert.equal(r.record.net_amount, 23.64);
  assert.equal(r.record.status, "COMPLETED");
});

test("unattributed PayPal captures cannot masquerade as platform support", () => {
  const c = capture();
  delete c.resource.custom_id;
  assert.deepEqual(classifyPayPalEvent(c), { kind: "ignored", reason: "unattributed_capture" });
  const other = capture();
  other.resource.custom_id = "unrelated-checkout";
  assert.equal(classifyPayPalEvent(other).kind, "ignored");
});

test("ignores campaign checkout captures and unrelated events", () => {
  const c = capture();
  c.resource.custom_id = "camp1|2500|120|250|paypal|gift_first_v2";
  assert.equal(classifyPayPalEvent(c).kind, "ignored");
  assert.equal(classifyPayPalEvent(capture({ event_type: "PAYMENT.SALE.COMPLETED" })).kind, "ignored");
});

test("reversal events can be matched against existing support captures", () => {
  const event = capture({ event_type: "PAYMENT.CAPTURE.REVERSED" });
  delete event.resource.custom_id;
  assert.equal(classifyPayPalEvent(event).kind, "platform_support");
});

test("refund events map back to the original capture", () => {
  const r = classifyPayPalEvent({
    id: "WH-2",
    event_type: "PAYMENT.CAPTURE.REFUNDED",
    resource: {
      id: "REF9",
      amount: { currency_code: "USD", value: "10.00" },
      links: [{ rel: "up", href: "https://api-m.paypal.com/v2/payments/captures/CAP123" }],
    },
  });
  assert.equal(r.record.paypal_capture_id, "CAP123");
  assert.equal(r.record.refunded_amount, 10);
  assert.equal(r.record.gross_amount, null);
});

test("config and mode helpers", () => {
  assert.equal(paypalApiBase("live"), "https://api-m.paypal.com");
  assert.equal(paypalApiBase("sandbox"), "https://api-m.sandbox.paypal.com");
  assert.equal(missingPayPalWebhookConfig({}).length, 6);
});

test("new Supabase secret key satisfies configuration without legacy JWT", () => {
  const config = {
    PAYPAL_MODE: "sandbox",
    PAYPAL_CLIENT_ID: "id",
    PAYPAL_CLIENT_SECRET: "secret",
    PAYPAL_WEBHOOK_ID: "webhook",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret_example",
  };
  assert.deepEqual(missingPayPalWebhookConfig(config), []);
});

test("payment RPC uses modern apikey only and legacy JWT bearer when necessary", async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify("recorded"), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const env = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_test" };
  assert.equal(await recordPlatformSupportPayment({ event_id: "evt1" }, {}, env, fakeFetch), "recorded");
  assert.equal(calls[0].options.headers.apikey, "sb_secret_test");
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.match(calls[0].url, /\/rest\/v1\/rpc\/ifund_record_platform_support_payment$/);

  assert.equal(await recordPlatformSupportPayment({}, {}, {
    SUPABASE_URL: env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: "legacy.jwt.value",
  }, fakeFetch), "recorded");
  assert.equal(calls[1].options.headers.apikey, "legacy.jwt.value");
  assert.equal(calls[1].options.headers.Authorization, "Bearer legacy.jwt.value");
  await assert.rejects(recordPlatformSupportPayment({}, {}, {
    SUPABASE_URL: env.SUPABASE_URL, SUPABASE_SECRET_KEY: "sb_publishable_bad",
  }, fakeFetch), /server-side Supabase secret key/);
  assert.equal(calls.length, 2);
});

test("webhook returns 503 when unconfigured and 400 on bad signature", async () => {
  const req = () => new Request("https://x/api/paypal/webhook", { method: "POST", body: JSON.stringify(capture()) });
  assert.equal((await handlePayPalWebhook(req(), {})).status, 503);
  const env = {
    PAYPAL_MODE: "sandbox", PAYPAL_CLIENT_ID: "id", PAYPAL_CLIENT_SECRET: "s",
    PAYPAL_WEBHOOK_ID: "w", SUPABASE_URL: "https://db", SUPABASE_SERVICE_ROLE_KEY: "k",
  };
  // Missing PayPal transmission headers: rejected before any network call.
  const res = await handlePayPalWebhook(req(), env, () => { throw new Error("no network"); });
  assert.equal(res.status, 400);
});

test("signature verification forwards original event JSON bytes", async () => {
  const raw = '{ "id":"WH-1", "resource": { "custom_id":"ifund:platform-support:v1" } }';
  const env = { PAYPAL_MODE: "sandbox", PAYPAL_CLIENT_ID: "id", PAYPAL_CLIENT_SECRET: "secret", PAYPAL_WEBHOOK_ID: "WHID" };
  const headers = new Headers({
    "paypal-auth-algo": "SHA256withRSA", "paypal-cert-url": "https://api.sandbox.paypal.com/cert",
    "paypal-transmission-id": "T-1", "paypal-transmission-sig": "sig",
    "paypal-transmission-time": "2026-10-25T20:00:00Z"
  });
  const calls = [];
  const fakeFetch = async (url, opt) => {
    calls.push({ url, opt });
    return new Response(JSON.stringify(calls.length === 1
      ? { access_token: "token" } : { verification_status: "SUCCESS" }), { status: 200 });
  };
  assert.equal(await verifyPayPalWebhook(headers, raw, env, fakeFetch), true);
  assert.ok(calls[1].opt.body.includes('"webhook_event":' + raw));
});

test("unmatched refunds cannot insert support payment rows", () => {
  const sql = readFileSync("supabase/migrations/pending/payments_platform_support_001.sql", "utf8");
  assert.match(sql, /UPDATE ifund_finance.platform_support_payment AS t/);
  assert.match(sql, /RAISE EXCEPTION 'unmatched platform-support refund/);
  assert.match(sql, /RAISE EXCEPTION 'unmatched platform-support reversal/);
  assert.doesNotMatch(sql, /VALUES \(v_capture, 'REFUNDED'/);
});

test("pending SQL keeps the ifund_finance fail-closed mapping", () => {
  const sql = readFileSync("supabase/migrations/pending/payments_platform_support_001.sql", "utf8");
  assert.match(sql, /ifund_finance\.platform_support_payment/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /USING \(false\) WITH CHECK \(false\)/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.ifund_record_platform_support_payment\(jsonb, jsonb\) TO service_role/);
  assert.doesNotMatch(sql, /TO (anon|authenticated);/);
});
