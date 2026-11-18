import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dialog = readFileSync(new URL("../src/components/payments/CampaignDonationDialog.jsx",import.meta.url),"utf8");
const footer = readFileSync(new URL("../src/components/payments/PlatformSupportHostedButton.jsx",import.meta.url),"utf8");

test("mobile payment sheet keeps verified checkout actions at the bottom",()=>{
  const amount=dialog.indexOf("Choose a one-time donation amount");
  const fields=dialog.indexOf('aria-label="Credit or debit card checkout"');
  const actions=dialog.indexOf('aria-label="Payment actions"');
  const paypal=dialog.indexOf('aria-label="Eligible PayPal payment buttons"');
  assert.ok(amount>=0&&fields>amount&&actions>fields&&paypal>actions);
  assert.match(dialog,/sticky bottom-0/);
  assert.match(dialog,/env\(safe-area-inset-bottom\)/);
  assert.match(dialog,/aria-pressed=\{Number\(amount\)===value\}/);
  assert.ok(dialog.includes("<dt>Total you approve</dt>"));
  assert.ok(dialog.includes('aria-label="Donation payment summary"'));
  assert.doesNotMatch(dialog,/Total you approve in PayPal/);
  assert.ok(dialog.includes("The amount shown above is the total you will authorize through your selected payment method."));
  assert.ok(dialog.indexOf("<GooglePayDonationButton ")<fields,"eligible one-tap wallet precedes manual card fields");
  assert.ok(dialog.includes("PayPal wallet (optional)"));
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

test("platform support footer is not misrepresented as a campaign gift",()=>{
  assert.match(footer,/IFUND_PLATFORM_SUPPORT_PAYMENT_LINK/);
  assert.match(footer,/does not fund the/);
  assert.match(footer,/PayPal offers you at checkout/);
  assert.match(footer,/rel="noopener noreferrer"/);
  assert.doesNotMatch(footer,/\/api\/payments\/create-order/);
});
