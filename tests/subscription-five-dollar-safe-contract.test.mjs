import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const web=readFileSync(new URL("../workers/ifund-payments/worker.js",import.meta.url),"utf8");
const edge=readFileSync(new URL("../supabase/functions/ifund-payment-ledger/index.ts",import.meta.url),"utf8");
test("Basic monthly target is $4.99",()=>assert.match(web,/amount_cents:499/));
test("old PayPal ID has no fallback",()=>assert.doesNotMatch(web,/BASIC_MONTHLY_PLAN\.plan_id/));
test("new subscription requires independently configured matching PayPal",()=>{
 assert.match(web,/IFUND_BASIC_MONTHLY_PAYPAL_PLAN_ID/);
 assert.match(web,/subscription_price_or_provider_mismatch/);
 assert.ok(web.indexOf("subscription_price_or_provider_mismatch")<web.indexOf('paypal(env,"/v1/billing/subscriptions"'));
});
test("backend refuses unverified and non-$4.99 plans",()=>{
 assert.match(edge,/plan\.amount_cents!==499/);
 assert.match(edge,/!plan\.verified_at\|\|!plan\.webhook_verified_at/);
 assert.match(edge,/plan\.active!==true/);
});
