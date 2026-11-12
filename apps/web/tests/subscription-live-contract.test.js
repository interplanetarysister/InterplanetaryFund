import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const file = path => readFileSync(new URL(path, import.meta.url), "utf8");
const worker=file("../../../workers/ifund-payments/worker.js");
const edge=file("../../../supabase/functions/ifund-payment-ledger/index.ts");
const migration=file("../../../supabase/migrations/20261112150500_ifund_live_paypal_subscriptions.sql");
const page=file("../src/pages/Subscriptions.jsx");
const app=file("../src/App.jsx");

test("campaign donations still require provider verification before ledger finalization",()=>{
  assert.match(worker,/verifyCapture\(env,reference,intent\)/);
  assert.match(worker,/signLedger\(env,"finalize"/);
  assert.match(edge,/ifund_finalize_verified_live_paypal_capture/);
  assert.match(edge,/PAYMENT\.CAPTURE\.COMPLETED/);
});

test("subscription checkout is member-owned and provider verified",()=>{
  assert.match(worker,/\/api\/payments\/subscriptions\/start/);
  assert.match(worker,/memberToken\(req\)/);
  assert.match(worker,/subscriptionReadiness\(env\)/);
  assert.match(worker,/\/v1\/billing\/subscriptions/);
  assert.match(worker,/subscription_get/);
  assert.match(worker,/subscription_provider_identity_mismatch/);
  assert.match(edge,/resolveVerifiedDonor\(p\.member_access_token\)/);
  assert.match(edge,/row\.member_id!==memberId/);
});

test("subscription ledger is durable, idempotent, and member scoped",()=>{
  assert.match(migration,/create table if not exists public\.ifund_subscription_ledger/);
  assert.match(migration,/operation_key text not null unique/);
  assert.match(migration,/ifund_subscription_ledger_sign/);
  assert.match(migration,/using \(\(select auth\.uid\(\)\) = member_id\)/);
  assert.match(edge,/paypal:subscription:payment:/);
  assert.match(edge,/paypal:subscription:reversal:/);
  assert.match(edge,/subscription_event/);
});

test("only the owner supplied basic monthly plan is initially eligible",()=>{
  assert.match(worker,/P-6YD2273006199630KNLDXBLA/);
  assert.match(worker,/amount_cents:1200/);
  assert.match(worker,/exactBasicPlan/);
  assert.match(worker,/subscription_plan_readiness/);
  assert.match(worker,/plan_ready:planReady,webhook_ready:webhookReady/);
  assert.match(worker,/ready:planReady&&webhookReady/);
  assert.match(edge,/subscription_plan_readiness/);
  assert.match(edge,/active:p\.plan_ready&&p\.webhook_ready/);
  assert.match(migration,/\('basic','monthly',1200,'USD','2026-10-v1','P-6YD2273006199630KNLDXBLA'\)/);
  assert.match(worker,/subscription_plan_unavailable/);
});

test("subscription billing webhooks require PayPal signature verification",()=>{
  assert.match(worker,/verify-webhook-signature/);
  assert.match(worker,/SUBSCRIPTION_EVENTS\.has\(kind\)/);
  assert.match(worker,/PAYMENT\.SALE\.COMPLETED/);
  assert.match(worker,/PAYMENT\.SALE\.REFUNDED/);
  assert.match(worker,/PAYMENT\.SALE\.REVERSED/);
});

test("subscriptions are accessible from the signed-in application",()=>{
  assert.match(app,/pages\/Subscriptions/);
  assert.match(app,/path="\/subscriptions"/);
  assert.doesNotMatch(app,/\/subscriptions",\s*$/m);
  assert.match(page,/Plans & subscriptions/);
  assert.match(page,/Subscribe with PayPal/);
  assert.match(page,/Cancel PayPal subscription/);
  assert.match(page,/provider-confirmed payment/);
});
