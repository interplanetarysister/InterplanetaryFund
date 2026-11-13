import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const worker = readFileSync(new URL("../../../workers/ifund-payments/worker.js", import.meta.url), "utf8");
const plans = worker.slice(worker.indexOf("async function subscriptionPlans("),worker.indexOf("async function startSubscription("));
test("public subscription catalog fails closed unless the exact provider plan and webhook are currently verified", () => {
  assert.match(plans, /available:Boolean\(readiness\.ready&&row\.active&&row\.verified_at/);
  assert.match(plans, /row\.tier===BASIC_MONTHLY_PLAN\.tier/);
  assert.match(plans, /row\.interval===BASIC_MONTHLY_PLAN\.interval/);
  assert.match(plans, /row\.paypal_plan_id===BASIC_MONTHLY_PLAN\.plan_id/);
  assert.match(plans, /Number\(row\.amount_cents\)===BASIC_MONTHLY_PLAN\.amount_cents/);
  assert.match(plans, /row\.currency==="USD"/);
  assert.doesNotMatch(plans, /available:Boolean\(row\.active&&row\.paypal_plan_id&&readiness\.webhook_ready\)/);
});
test("subscription creation independently checks provider readiness and rejects unsupported tiers", () => {
  const start = worker.slice(worker.indexOf("async function startSubscription("),worker.indexOf("async function confirmSubscription("));
  assert.match(start, /if\(body\.tier!=="basic"\|\|body\.interval!=="monthly"\)/);
  assert.match(start, /if\(!readiness\.ready\)return asError\("subscription_billing_not_ready",503\)/);
});
