import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url),"utf8");
test("Basic $4.99 proposal changes only an inactive and unverified catalog row",()=>{
 const sql=read("../../../supabase/migrations/20261122115500_ifund_basic_499_pending_catalog.sql");
 assert.match(sql,/v_plan.active or v_plan.verified_at is not null/);
 assert.match(sql,/if exists\(select 1 from public.ifund_subscription_intents/);
 assert.match(sql,/if v_plan.amount_cents=499 then/);
 assert.match(sql,/elsif v_plan.amount_cents<>500 then/);
 assert.match(sql,/set amount_cents=499/);
 assert.match(sql,/and active=false and verified_at is null and amount_cents=500/);
 assert.match(sql,/paid_enrollment_ready=false/);
 assert.doesNotMatch(sql,/update public.ifund_subscription_ledger/);
});
test("Provider-backed subscription activation still fails closed without matching real provider plan",()=>{
 const worker=read("../../../workers/ifund-payments/worker.js");
 const subscription=read("../src/lib/subscriptionEnrollment.mjs");
 assert.match(worker,/exactBasicPlan/);
 assert.match(worker,/subscriptionReadiness\(env\)/);
 assert.match(worker,/subscription_billing_not_ready/);
 assert.match(subscription,/plan\?\.available === true && plan\?\.verified === true/);
});
