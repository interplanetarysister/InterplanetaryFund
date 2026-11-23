import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {initialBillingChoice,chooseBillingMethod,chooseBillingMode,canBeginBilling} from "../src/lib/premiumBillingChoice.mjs";

const page=readFileSync(new URL("../src/pages/Subscriptions.jsx",import.meta.url),"utf8");
const choice=readFileSync(new URL("../src/components/subscriptions/PremiumBillingChoices.jsx",import.meta.url),"utf8");
const once=readFileSync(new URL("../src/components/subscriptions/PremiumOneTimeCheckout.jsx",import.meta.url),"utf8");
const worker=readFileSync(new URL("../../../workers/ifund-payments/worker.js",import.meta.url),"utf8");
const edge=readFileSync(new URL("../../../supabase/functions/ifund-payment-ledger/index.ts",import.meta.url),"utf8");
const sql=readFileSync(new URL("../../../supabase/migrations/20261123000000_ifund_premium_one_time_purchase_ledger.sql",import.meta.url),"utf8");

test("PayPal and Google Pay select recurring monthly billing by default",()=>{
  assert.deepEqual(initialBillingChoice("paypal"),{method:"paypal",mode:"recurring"});
  assert.deepEqual(initialBillingChoice("googlepay"),{method:"googlepay",mode:"recurring"});
  assert.deepEqual(chooseBillingMethod({method:"card",mode:"one_time"},"googlepay"),
    {method:"googlepay",mode:"recurring"});
});
test("Credit or debit card defaults to one-time Premium, but billing mode remains selectable",()=>{
  assert.deepEqual(initialBillingChoice("card"),{method:"card",mode:"one_time"});
  assert.deepEqual(chooseBillingMode(initialBillingChoice("paypal"),"one_time"),
    {method:"paypal",mode:"one_time"});
  assert.deepEqual(chooseBillingMode(initialBillingChoice("card"),"recurring"),
    {method:"card",mode:"recurring"});
});
test("No automatic enrollment from method selection; provider and account readiness required",()=>{
  const base={choice:initialBillingChoice("paypal"),authenticated:true,verifiedPlan:true,native:false,providerReady:true,oneTimeReady:false,googleRecurringReady:false};
  assert.equal(canBeginBilling(base),true);
  assert.equal(canBeginBilling({...base,choice:initialBillingChoice("googlepay")}),false);
  assert.equal(canBeginBilling({...base,choice:initialBillingChoice("card")}),false);
  assert.equal(canBeginBilling({...base,verifiedPlan:false}),false);
  assert.equal(canBeginBilling({...base,native:true}),false);
  assert.match(choice,/renewalConsent/);
  assert.match(choice,/I understand that this plan bills \$4\.99 USD each month/);
  assert.match(choice,/Google Pay recurring billing is not yet authorized/);
});
test("One-time PayPal uses Orders v2 card-hosted checkout, not donation ledger or subscription vault",()=>{
  assert.match(once,/paypal\.CardFields/);
  assert.match(once,/create-order/);
  assert.match(once,/capture-order/);
  assert.match(once,/premium-one-time/);
  assert.doesNotMatch(once,/campaign_id|donation_id/);
  assert.match(worker,/premium_one_time_finalize/);
  assert.match(worker,/ifund-premium-one-time/);
  assert.match(edge,/premium_one_time_begin/);
  assert.match(edge,/resolveVerifiedDonor/);
  assert.match(sql,/ifund_premium_one_time_finalize/);
  assert.match(sql,/current_user <> 'service_role'/);
  assert.match(sql,/enable row level security/);
});
test("One-time payment remains gated by Worker, authenticated admin and signed readiness",()=>{
  assert.match(worker,/IFUND_PREMIUM_ONE_TIME_ENABLED==="true"/);
  assert.match(edge,/IFUND_PREMIUM_ONE_TIME_ENABLED"\)==="false"/);
  assert.match(edge,/premium_one_time_test_eligible/);
  assert.match(worker,/IFUND_PREMIUM_ONE_TIME_TEST_ONLY==="true"/);
  assert.match(worker,/subscriptionAtomicReadiness\(env\)/);
  assert.match(page,/<PremiumBillingChoices/);
  assert.match(choice,/<PremiumOneTimeCheckout/);
});
