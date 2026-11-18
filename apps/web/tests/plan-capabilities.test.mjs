import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {PLAN_DISPLAY,PLAN_ORDER,canEnroll,displayPrice,validProviderPlan} from "../src/lib/planCapabilities.mjs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const basic={tier:"basic",interval:"monthly",amount_cents:1200,currency:"USD",available:true,verified:true};
test("free features are explicitly differentiated from paid AI and platform posting",()=>{
  assert.ok(PLAN_DISPLAY.free.features.some(x=>/Manual social copy/.test(x)));
  assert.match(PLAN_DISPLAY.free.note,/No automatic external posting/);
  assert.match(PLAN_DISPLAY.basic.description,/Paid AI writing access/);
  for(const tier of PLAN_ORDER) assert.ok(PLAN_DISPLAY[tier].features.length);
});
test("provider readiness and verified member status are required for enrollment",()=>{
  assert.equal(validProviderPlan(basic),true);
  assert.equal(displayPrice(basic),"$12.00");
  assert.equal(canEnroll(basic,{statusLoad:"ready"}),true);
  assert.equal(canEnroll({...basic,verified:false},{statusLoad:"ready"}),false);
  assert.equal(canEnroll({...basic,available:false},{statusLoad:"ready"}),false);
  assert.equal(canEnroll(basic,{statusLoad:"unavailable"}),false);
  assert.equal(canEnroll(basic,{statusLoad:"ready",native:true}),false);
  assert.equal(canEnroll(basic,{statusLoad:"ready",hasSubscription:true}),false);
  assert.equal(canEnroll({...basic,amount_cents:NaN},{statusLoad:"ready"}),false);
  assert.equal(canEnroll({...basic,tier:"unknown"},{statusLoad:"ready"}),false);
});
test("subscription UI does not advertise unverified plans as purchase-ready",()=>{
  const member=read("src/pages/Subscriptions.jsx");
  const publicPage=read("src/pages/PublicSubscriptionPlans.jsx");
  const payments=read("../../workers/ifund-payments/worker.js");
  assert.match(member,/canEnroll\(plan/);
  assert.match(member,/Plans & subscriptions/);
  assert.match(member,/Subscribe with PayPal/);
  assert.match(publicPage,/plan\.available\s*===\s*true\s*&&\s*plan\.verified\s*===\s*true/);
  assert.match(payments,/body.tier!=="basic"\|\|body.interval!=="monthly"/);
  assert.match(payments,/subscriptionReadiness\(env\)/);
});
test("verified subscription payment is the only source of paid entitlement projection",()=>{
  const sql=read("../../supabase/migrations/20261118200000_ifund_subscription_verified_entitlements.sql");
  assert.match(sql,/ifund_subscription_ledger/);
  assert.match(sql,/provider_resource_id is not null/);
  assert.match(sql,/last_provider_status='ACTIVE'/);
  assert.match(sql,/ifund_access.member_entitlements/);
  assert.match(sql,/refund','reversal/);
  assert.doesNotMatch(sql,/grant\s+insert\s+on\s+ifund_access.member_entitlements\s+to\s+authenticated/i);
});
