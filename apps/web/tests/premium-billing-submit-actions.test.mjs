import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const choices=readFileSync(new URL("../src/components/subscriptions/PremiumBillingChoices.jsx",import.meta.url),"utf8");
const recurring=readFileSync(new URL("../src/components/subscriptions/CardSubscriptionCheckout.jsx",import.meta.url),"utf8");
const oneTime=readFileSync(new URL("../src/components/subscriptions/PremiumOneTimeCheckout.jsx",import.meta.url),"utf8");

test("each Premium billing selection offers a visible payment action",()=>{
  assert.match(choices,/Subscribe \$4\.99\/month with Google Pay/);
  assert.match(choices,/Pay \$4\.99 once with Google Pay/);
  assert.match(choices,/Continue to PayPal — \$4\.99\/month/);
  assert.match(choices,/<CardSubscriptionCheckout plan=\{plan\} hasExistingSubscription=\{existing\} consented=\{renewalConsent\}/);
  assert.match(choices,/<PremiumOneTimeCheckout key=\{choice\.method\}/);
  assert.match(oneTime,/Pay \$4\.99 now — one month, no renewal/);
  assert.match(oneTime,/Continue with PayPal — pay \$4\.99 once/);
});
test("no unavailable Google Pay option can submit an unsupported charge",()=>{
  assert.match(choices,/method==="googlepay"\?<div className="space-y-2">/);
  assert.match(choices,/Google Pay recurring billing is not yet authorized/);
  assert.match(choices,/One-time Google Pay for Premium is not provider-verified/);
  assert.match(choices,/disabled aria-disabled="true"/);
});
test("recurring card enrollment waits for explicit renewal consent and explains provider redirect",()=>{
  assert.match(recurring,/consented=false/);
  assert.match(recurring,/\|\|!consented\)return/);
  assert.match(recurring,/&&!native&&consented/);
  assert.match(recurring,/!consented\?"Agree to renewal terms to continue"/);
  assert.match(recurring,/PayPal approval, not a direct card-number form/);
  assert.match(choices,/renewalConsent/);
});
test("SDK loading displays a disabled action rather than a missing payment button",()=>{
  assert.match(oneTime,/method==="paypal"&&!sdkReady&&<button type="button" disabled/);
  assert.match(oneTime,/method==="card"&&<section aria-label="Secure one-time card fields"/);
  assert.match(oneTime,/disabled=\{!cardReady\|\|busy\}/);
});
