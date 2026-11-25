import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dialog = readFileSync(new URL("../src/components/payments/CampaignDonationDialog.jsx", import.meta.url), "utf8");
const once = readFileSync(new URL("../src/components/subscriptions/PremiumOneTimeCheckout.jsx", import.meta.url), "utf8");

test("Defect 1: checkout heading matches the live payment summary text", () => {
  assert.match(dialog, /Total you approve/);
  assert.doesNotMatch(dialog, /Total you approve in PayPal/);
});

test("Defect 2: deferred PayPal wallet render never targets a detached node", () => {
  assert.match(dialog, /if\(cancelled\|\|!paypalHost\.current\?\.isConnected\)return;/);
  assert.match(dialog, /return buttons\.render\(paypalHost\.current\)/);
});

test("donation hosted fields render independently with per-field fallbacks", () => {
  assert.match(dialog, /Promise\.allSettled\(/);
  assert.doesNotMatch(dialog, /Promise\.all\(\[/);
  assert.match(dialog, /fieldErrors/);
  assert.match(dialog, /Card number field could not load/);
  assert.match(dialog, /Expiration field could not load/);
  assert.match(dialog, /Security code field could not load/);
  // A wallet failure is a notice, not an error that hides the card form.
  assert.match(dialog, /setWalletNotice\("PayPal wallet checkout is unavailable/);
  assert.doesNotMatch(dialog, /setError\("PayPal wallet checkout is unavailable/);
});

test("SDK load failure shows a retry instead of a dead card form", () => {
  assert.match(dialog, /sdkFailed/);
  assert.match(dialog, /Retry secure checkout/);
  assert.match(dialog, /setLoadAttempt\(n=>n\+1\)/);
  assert.match(dialog, /Secure checkout could not load/);
});

test("donation single sheet orders amount, fields, confirm, Google Pay, PayPal", () => {
  const order = [
    dialog.indexOf("Choose your donation"),
    dialog.indexOf('aria-label="Credit or debit card checkout"'),
    dialog.indexOf('aria-label="Confirm card payment"'),
    dialog.indexOf('aria-label="Google Pay checkout"'),
    dialog.indexOf('aria-label="PayPal checkout"'),
  ];
  assert.ok(order.every(index => index >= 0), "every checkout section must exist");
  assert.ok(order.every((index, i) => i === 0 || index > order[i - 1]), "sections must appear in checkout order");
  assert.doesNotMatch(dialog, /aria-label="Payment actions"/);
  assert.match(dialog, /Confirm card payment/);
});

test("sandbox SDK load requests card fields; live load keeps Google Pay", () => {
  assert.match(dialog, /sandbox\?"&components=buttons,card-fields"/);
  assert.match(dialog, /components=buttons,card-fields,googlepay/);
});

test("Premium is a single sheet: card first, Google Pay, then PayPal", () => {
  const order = [
    once.indexOf('aria-label="Secure one-time card fields"'),
    once.indexOf('aria-label="Google Pay checkout"'),
    once.indexOf('aria-label="PayPal checkout"'),
  ];
  assert.ok(order.every(index => index >= 0), "every Premium checkout section must exist");
  assert.ok(order[1] > order[0] && order[2] > order[1], "card, then Google Pay, then PayPal");
  assert.match(once, /Pay by card · \$4\.99 USD once/);
  assert.match(once, /Pay \$4\.99 by card now/);
  assert.doesNotMatch(once, /method==="card"&&<section aria-label="Secure one-time card fields"/);
  assert.doesNotMatch(once, /if\(method==="paypal"\)/);
  assert.doesNotMatch(once, /style=\{\{display:method==="paypal"\?"block":"none"\}\}/);
});

test("Premium Google Pay is explicitly unverified, never claimed as available", () => {
  assert.match(once, /Google Pay is not yet verified for one-time Premium purchases/);
  assert.match(once, /No Google Pay charge can be started here/);
  assert.doesNotMatch(once, /One-time Google Pay enrollment is not yet verified for Premium\. Choose card or PayPal\./);
  assert.doesNotMatch(once, /components=buttons,card-fields,googlepay/);
});

test("Premium card readiness uses the run's own render result, not stale state", () => {
  assert.match(once, /cardBecameReady/);
  assert.match(once, /if\(method==="card"&&!cardBecameReady\)/);
  assert.doesNotMatch(once, /!cardReady&&\(!card\|\|!card\.isEligible\(\)\)/);
  assert.match(once, /Promise\.allSettled\(/);
  assert.doesNotMatch(once, /Promise\.all\(\[/);
  assert.match(once, /setWalletNotice\("PayPal wallet checkout is unavailable/);
});
