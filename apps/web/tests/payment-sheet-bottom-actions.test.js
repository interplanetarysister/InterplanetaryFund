import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dialog = readFileSync(new URL("../src/components/payments/CampaignDonationDialog.jsx",import.meta.url),"utf8");
const footer = readFileSync(new URL("../src/components/payments/PlatformSupportHostedButton.jsx",import.meta.url),"utf8");
const platform = readFileSync(new URL("../src/components/payments/PlatformSupportDonationDialog.jsx",import.meta.url),"utf8");

test("mobile payment sheet keeps checkout actions in a non-overlapping safe-area flow",()=>{
  const amount=dialog.indexOf("Choose your donation");
  const fields=dialog.indexOf('aria-label="Credit or debit card checkout"');
  const actions=dialog.indexOf('aria-label="Payment actions"');
  const paypal=dialog.indexOf('aria-label="Eligible PayPal payment buttons"');
  assert.ok(amount>=0&&fields>amount&&actions>fields&&paypal>actions);
  assert.doesNotMatch(dialog,/sticky bottom-0/);
  assert.match(dialog,/env\(safe-area-inset-bottom\)/);
  assert.match(dialog,/aria-pressed=\{Number\(amount\)===value\}/);
  assert.ok(dialog.includes("Total you approve in PayPal"));
});

test("payment buttons remain provider controlled with verified capture",()=>{
  assert.match(dialog,/window\.paypal\?\.Buttons/);
  assert.match(dialog,/paypal\.Buttons\(/);
  assert.match(dialog,/card\.isEligible\(\)/);
  assert.match(dialog,/cardSession\.current\.submit\(\)/);
  assert.match(dialog,/data\.checkout_token!==checkoutToken/);
  assert.match(dialog,/result\.status!=="captured"/);
  assert.match(dialog,/!result\.donation_id/);
  assert.doesNotMatch(dialog,/>Pay with Venmo<|>Pay Later</);
});

test("platform support opens its own verified donation checkout and stays separate from campaign gifts",()=>{
  assert.match(footer,/PlatformSupportDonationDialog/);
  assert.match(footer,/onClick=\{\(\)=>setOpen\(true\)\}/);
  assert.match(footer,/does not fund the campaign/);
  assert.match(footer,/Donate to IFund/);
  assert.doesNotMatch(footer,/IFUND_PLATFORM_SUPPORT_PAYMENT_LINK|PayPal offers you at checkout/);
  assert.match(platform,/create-platform-support-order/);
  assert.match(platform,/capture-platform-support-order/);
});
