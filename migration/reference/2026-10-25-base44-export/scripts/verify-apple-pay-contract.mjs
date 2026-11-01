import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computePayPalBreakdown, computePayPalWalletBreakdown } from "../src/lib/fees.js";

const read = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const apple = read("src/components/payments/ApplePayButton.jsx");
const dialog = read("src/components/campaigns/DonateDialog.jsx");
const sdk = read("src/components/payments/paypalScripts.js");
const create = read("base44/functions/createPayPalOrder/entry.ts");
const capture = read("base44/functions/capturePayPalOrder/entry.ts");
const flags = read("base44/shared/featureFlagGate.ts");
const readiness = read("base44/shared/liveProviderReadiness.ts");
const listing = read("base44/functions/listUntrackedPayPalReceipts/entry.ts");
const recovery = read("base44/functions/reconcileDirectPayPalCampaignDonation/entry.ts");
const donation = read("base44/entities/Donation.jsonc");
const holding = read("base44/entities/HoldingLedgerEntry.jsonc");

assert.match(sdk, /components=buttons,googlepay,applepay&intent=capture/);
assert.match(sdk, /applepay\.cdn-apple\.com\/jsapi\/1\.latest\/apple-pay-sdk\.js/);
assert.match(apple, /window\.ApplePaySession\?\.canMakePayments/);
assert.match(apple, /eligibility\?\.isEligible !== true/);
assert.match(apple, /applepay\.validateMerchant/);
assert.match(apple, /applepay\.confirmOrder/);
assert.match(apple, /session\.onpaymentauthorized/);
assert.match(apple, /payment_channel: "applepay"/);
assert.match(apple, /capturePayPalOrder/);
assert.match(apple, /captured\?\.ok !== true \|\| !captured\.canonical_operation_id/);
assert.match(apple, /STATUS_SUCCESS/);
assert.match(apple, /confirmedWithProvider \? "review" : "unavailable"/);
assert.doesNotMatch(apple, /type", "donate"/); // reserved for approved charities
assert.doesNotMatch(apple, /window\.location|location\.href|window\.open\(/);
assert.match(dialog, /useFeatureEnabled\("apple_pay_checkout"\)/);
assert.match(dialog, /<ApplePayButton /);
assert.match(create, /\['paypal', 'googlepay', 'applepay'\]\.includes\(payment_channel\)/);
assert.match(create, /channel === 'applepay' \? 'apple_pay_checkout'/);
assert.match(create, /computePayPalBreakdown\(Number\(amount\), platform_contribution === true, channel\)/);
assert.match(capture, /\['paypal', 'googlepay', 'applepay'\]\.includes\(parts\[4\]\)/);
assert.match(capture, /paymentChannel === 'applepay' \? 'Apple Pay'/);
assert.match(capture, /operationKey = `paypal:\$\{order_id\}`/);
assert.match(flags, /apple_pay_checkout: 'beta'/);
assert.match(readiness, /apple_pay_checkout: settled\(false/);
assert.match(listing, /payment_method: 'applepay'/);
assert.match(recovery, /\['paypal', 'googlepay', 'applepay'\]/);
assert.ok(JSON.parse(donation).properties.payment_method.enum.includes("applepay"));
assert.ok(JSON.parse(holding).properties.payment_channel.enum.includes("applepay"));
for (const total of [1, 25, 100]) {
  for (const contribution of [false, true]) {
    assert.deepEqual(computePayPalBreakdown(total, contribution, "applepay"), computePayPalWalletBreakdown(total, contribution));
  }
}
console.log("Apple Pay gated checkout, captured ledger path, and recovery contracts verified.");
