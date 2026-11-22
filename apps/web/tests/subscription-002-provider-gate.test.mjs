import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const worker=read("../../../workers/ifund-payments/worker.js");
const plan=read("../../../supabase/migrations/20261122130000_ifund_subscription_002_plan_staged.sql");
const billing=read("../src/pages/Subscriptions.jsx");
const publicPlans=read("../src/pages/PublicSubscriptionPlans.jsx");

test("subscription-002 is the only mapped $4.99 Basic monthly payment candidate",()=>{
  assert.match(worker,/plan_id:"P-8RG59105D5286480MNMBOKJA"/);
  assert.match(worker,/amount_cents:499/);
  assert.match(worker,/exactBasicPlan\(plan\)/);
  assert.match(worker,/subscriptionReadiness\(env\)/);
  assert.match(worker,/plan\?\.status==="ACTIVE"/);
  assert.match(worker,/subscription_provider_identity_mismatch/);
  assert.doesNotMatch(worker,/const BASIC_MONTHLY_PLAN[^\n]+P-6YD2273006199630KNLDXBLA/);
});
test("database migration preserves fail-closed enrollment and financial history",()=>{
  assert.ok(plan.includes("paypal_plan_id='P-8RG59105D5286480MNMBOKJA'"));
  assert.ok(plan.includes("amount_cents<>499"));
  assert.ok(plan.includes("paid_enrollment_ready=false"));
  assert.ok(plan.includes("if v_plan.active or v_plan.verified_at is not null"));
  assert.ok(plan.includes("public.ifund_subscription_intents"));
  assert.ok(plan.includes("public.ifund_subscription_plan_mapping"));
  assert.ok(plan.includes("active=false"));
  assert.ok(plan.includes("verified_at=null"));
  assert.ok(plan.includes("paypal_product_id=null"));
  assert.doesNotMatch(plan,/update public\.ifund_subscription_ledger/);
});
test("verified subscription checkout never embeds unbound PayPal button factory",()=>{
  assert.match(billing,/Interplanetary Fund Premium/);
  assert.match(publicPlans,/Interplanetary Fund Premium/);
  assert.match(billing,/\/api\/payments\/subscriptions\/start/);
  assert.match(billing,/\/api\/payments\/subscriptions\/confirm/);
  assert.match(billing,/\/api\/payments\/subscriptions\/cancel/);
  assert.doesNotMatch(billing,/paypal\.Buttons|vault=true|button-factory/);
});
