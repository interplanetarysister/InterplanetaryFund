import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const card=readFileSync(new URL("../src/components/subscriptions/CardSubscriptionCheckout.jsx",import.meta.url),"utf8");
const page=readFileSync(new URL("../src/pages/Subscriptions.jsx",import.meta.url),"utf8");
const chooser=readFileSync(new URL("../src/components/subscriptions/PremiumBillingChoices.jsx",import.meta.url),"utf8");
const worker=readFileSync(new URL("../../../workers/ifund-payments/worker.js",import.meta.url),"utf8");

test("Subscription card option reuses PayPal and never initializes Stripe",()=>{
  assert.match(card,/\/api\/payments\/subscriptions/);
  assert.match(card,/\/provider-readiness/);
  assert.match(card,/\/start/);
  assert.match(card,/authorization:"Bearer "/);
  assert.doesNotMatch(card,/stripe|Stripe|sk_live_|sk_test_/);
  assert.doesNotMatch(page,/stripe|Stripe/);
});
test("Card option enforces verified exact USD recurring price and live readiness",()=>{
  assert.match(card,/Number\(plan\.amount_cents\)===499/);
  assert.match(card,/plan\.currency==="USD"/);
  assert.match(card,/data\.purchase_ready===true/);
  assert.match(card,/data\.webhook_ready===true/);
  assert.match(card,/data\.atomic_ready===true/);
  assert.match(card,/hasExistingSubscription/);
  assert.match(card,/isNativeBundle\(\)/);
});
test("Card subscription uses owner-bound signed PayPal flow; no Orders v2 capture",()=>{
  assert.match(card,/authClient\(\)\.auth\.getSession\(\)/);
  assert.match(card,/tier:"basic",interval:"monthly",payment_preference:"card"/);
  assert.match(card,/paypal\.com/);
  assert.match(card,/new URL\(result\.approval_url\)/);
  assert.doesNotMatch(card,/capture-order|create-order|CardFields\(/);
  assert.match(worker,/async function startSubscription\(/);
  assert.match(worker,/signLedger\(env,"subscription_begin"/);
  assert.match(worker,/signLedger\(env,"subscription_bind"/);
  assert.match(worker,/subscription_atomic_event/);
  assert.match(worker,/reconcileSubscription\(/);
});
test("Card checkout communicates provider availability and no premature entitlement",()=>{
  assert.match(card,/depending on eligibility/i);
  assert.match(card,/if it does not, this recurring card option is unavailable/i);
  assert.match(card,/Premium activates only after a verified payment receipt/);
  assert.match(page,/<PremiumBillingChoices/);
  assert.match(chooser,/<CardSubscriptionCheckout/);
});
