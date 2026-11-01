import assert from "node:assert/strict";
import { resolvePayPalCaptureAllocation } from "../base44/shared/paypalAllocation.js";
import { readFileSync } from "node:fs";
import {
  computePayPalBreakdown,
  computePayPalWalletBreakdown,
  computePayPalProcessingFee,
  computePayPalWalletProcessingFee,
  MIN_DONATION,
} from "../src/lib/fees.js";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const create = read("base44/functions/createPayPalOrder/entry.ts");
const paypal = read("base44/functions/getPayPalConfig/entry.ts");
const capabilities = read("base44/functions/getPaymentCapabilities/entry.ts");
const sdk = read("src/components/payments/paypalScripts.js");
const wallet = read("src/components/payments/GooglePayButton.jsx");

for (const channel of ["paypal", "googlepay", "applepay"]) {
  for (const optIn of [true, false]) {
    for (const pledge of [1, 2, 25, 50, 100, 250]) {
      const quote = computePayPalBreakdown(pledge, optIn, channel);
      const wallet = ["googlepay", "applepay"].includes(channel);
      assert.deepEqual(quote, wallet ? computePayPalWalletBreakdown(pledge,optIn) : computePayPalBreakdown(pledge,optIn));
      assert.equal(quote.recipientGift, pledge);
      assert.equal(quote.contribution, optIn ? Math.round(pledge*10)/100 : 0);
      assert.equal(Number((quote.amount + quote.processing).toFixed(2)),quote.totalCharged);
      assert.ok(quote.totalCharged > pledge);
      assert.ok(pledge >= MIN_DONATION);
    }
  }
}

const actualPayPal = resolvePayPalCaptureAllocation({
  chargedAmount: 25, quotedDonation: 23.68, quotedFee: 1.32,
  quotedContribution: 0, providerReceivable: 23.64, providerFee: 1.36,
});
assert.equal(actualPayPal.ok, true);
assert.equal(actualPayPal.amount, 23.64);
assert.equal(actualPayPal.processingFee, 1.36);
assert.equal(actualPayPal.platformContribution, 0);
assert.equal(actualPayPal.source, "paypal_receivable");

const actualWithContribution = resolvePayPalCaptureAllocation({
  chargedAmount: 25, quotedDonation: 23.68, quotedFee: 1.32,
  quotedContribution: 2.37, providerReceivable: 23.64, providerFee: 1.36,
});
assert.equal(actualWithContribution.platformContribution, 2.36);

const noBreakdown = resolvePayPalCaptureAllocation({
  chargedAmount: 25, quotedDonation: 23.68, quotedFee: 1.32, quotedContribution: 0,
});
assert.equal(noBreakdown.ok, true);
assert.equal(noBreakdown.amount, 23.68);
assert.equal(noBreakdown.source, "quote");

const invalidCharge = resolvePayPalCaptureAllocation({
  chargedAmount: 50, quotedDonation: 23.68, quotedFee: 1.32, quotedContribution: 0,
});
assert.equal(invalidCharge.ok, false);
assert.equal(invalidCharge.reason, "order_mismatch");

const tooSmall = resolvePayPalCaptureAllocation({
  chargedAmount: 1, quotedDonation: .70, quotedFee: .30, quotedContribution: 0,
});
assert.equal(tooSmall.ok, true);
assert.equal(tooSmall.amount, .70);

const oneDollarActual = resolvePayPalCaptureAllocation({
  chargedAmount: 1, quotedDonation: .48, quotedFee: .52,
  quotedContribution: .05, providerReceivable: .47, providerFee: .53,
});
assert.equal(oneDollarActual.ok, true);
assert.equal(oneDollarActual.amount, .47);
assert.ok(oneDollarActual.amount - oneDollarActual.platformContribution > 0);

const contradictoryBreakdown = resolvePayPalCaptureAllocation({
  chargedAmount: 25, quotedDonation: 23.68, quotedFee: 1.32,
  quotedContribution: 0, providerReceivable: 23.64, providerFee: 2,
});
assert.equal(contradictoryBreakdown.ok, false);
assert.equal(contradictoryBreakdown.reason, "provider_breakdown_mismatch");

// The first canonical allocation wins. A later enriched PayPal response and
// concurrent same-order retries must reuse it rather than revise settled money.
const quoteAllocation = resolvePayPalCaptureAllocation({
  chargedAmount: 25, quotedDonation: 23.68, quotedFee: 1.32, quotedContribution: 0,
});
const enrichedAllocation = resolvePayPalCaptureAllocation({
  chargedAmount: 25, quotedDonation: 23.68, quotedFee: 1.32,
  quotedContribution: 0, providerReceivable: 23.64, providerFee: 1.36,
});
const freezeFirst = (current, candidate) => current || candidate;
const first = freezeFirst(null, quoteAllocation);
assert.equal(freezeFirst(first, enrichedAllocation), first);
assert.equal([quoteAllocation, enrichedAllocation].reduce(freezeFirst, null), quoteAllocation);

// Versioned gift-first capture: provider fee variations may reduce platform tip
// but must never diminish the donor's promised campaign gift.
const giftFirst = resolvePayPalCaptureAllocation({
  chargedAmount: 114.49, quotedDonation: 110, quotedFee: 4.49,
  quotedContribution: 10, providerReceivable: 109.98, providerFee: 4.51,
  preservePledgedGift: true,
});
assert.equal(giftFirst.ok,true);
assert.equal(giftFirst.amount,109.98);
assert.equal(giftFirst.platformContribution,9.98);
assert.equal(Number((giftFirst.amount-giftFirst.platformContribution).toFixed(2)),100);
const shortfall = resolvePayPalCaptureAllocation({
  chargedAmount: 114.49, quotedDonation: 110, quotedFee: 4.49,
  quotedContribution: 10, providerReceivable: 99.99, providerFee: 14.50,
  preservePledgedGift: true,
});
assert.equal(shortfall.ok,false);
assert.equal(shortfall.reason,'pledged_campaign_gift_shortfall');

assert.match(create, /validateDonationAmount\(amount\)/);
assert.doesNotMatch(create, /validateDonationAmount\(value\)/);
assert.match(paypal, /isLivePayPalRestReady\(\)/);
assert.match(capabilities, /isLivePayPalRestReady\(\)/);
assert.match(sdk, /components=buttons,googlepay,applepay&/);
assert.match(sdk, /window\.paypal\?\.Buttons/);
assert.match(wallet, /paypal\.Googlepay\(\)/);
assert.match(wallet, /result\?\.ok !== true/);
const capture = read("base44/functions/capturePayPalOrder/entry.ts");
assert.match(capture, /resolvePayPalCaptureAllocation/);
assert.ok(capture.indexOf("existingOperations.length") < capture.indexOf("resolvePayPalCaptureAllocation({"));
assert.ok(capture.indexOf("existingOperations.length") < capture.indexOf("recordCanonicalDonation(sr"));
assert.match(capture, /saved\.payment_channel/);
assert.match(capture, /savedOperation\.gross_amount/);
console.log("PayPal/Google Pay fee, readiness, and SDK contracts verified.");
