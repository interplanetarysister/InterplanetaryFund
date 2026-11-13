import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const button = readFileSync(new URL("../src/components/payments/GooglePayDonationButton.jsx", import.meta.url), "utf8");
const dialog = readFileSync(new URL("../src/components/payments/CampaignDonationDialog.jsx", import.meta.url), "utf8");
const worker = readFileSync(new URL("../../../workers/ifund-payments/worker.js", import.meta.url), "utf8");

test("Google Pay uses the same v5 SDK as the PayPal/card checkout", () => {
  assert.match(dialog, /components=buttons,card-fields,googlepay/);
  assert.match(button, /paypal\.Googlepay\(\)/);
  assert.doesNotMatch(button, /web-sdk\/v6/);
  assert.match(button, /https:\/\/pay\.google\.com\/gp\/p\/js\/pay\.js/);
});

test("Google Pay is shown only for PayPal-eligible merchants and devices", () => {
  assert.match(button, /paypalGooglePay\.config\(\)/);
  assert.match(button, /\.isReadyToPay\(/);
  assert.match(button, /eligible\?\.result/);
  assert.match(button, /environment: "PRODUCTION"/);
  assert.match(button, /className=\{ready \? "space-y-2" : "hidden"\}/);
});

test("wallet has exact amount and uses existing verified ledger capture", () => {
  assert.match(button, /amountCents \/ 100/);
  assert.match(button, /current\.current\.begin\("googlepay"\)/);
  assert.match(button, /confirmOrder/);
  assert.match(button, /confirmation\?\.status !== "APPROVED"/);
  assert.match(button, /initiatePayerAction/);
  assert.match(button, /current\.current\.capture\(\{ orderID: orderId \}\)/);
  assert.match(worker, /"googlepay"/);
  assert.match(dialog, /checkout_token:token/);
});

test("one wallet failure cannot hide existing card and PayPal methods", () => {
  assert.match(dialog, /paypal\.CardFields/);
  assert.match(dialog, /paypal\.Buttons/);
  assert.match(button, /if \(!cancelled\) setReady\(false\)/);
});

// Wallet integration is deliberately gated by live merchant and device eligibility.
