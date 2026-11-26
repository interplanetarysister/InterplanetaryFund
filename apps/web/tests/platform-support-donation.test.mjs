import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseDonationCents } from "../src/lib/donationAmount.mjs";

// Run: node --test apps/web/tests/platform-support-donation.test.mjs
// Embedded platform-support checkout. Backend contract (source-only until the
// migration is applied and the worker is deployed):
//   POST /api/payments/platform-support/create-order
//   POST /api/payments/platform-support/capture-order
// Never a campaign gift: no campaign_id is accepted, stored, or attributed.

const dialog = readFileSync(new URL("../src/components/payments/PlatformSupportDonationDialog.jsx", import.meta.url), "utf8");
const footer = readFileSync(new URL("../src/components/payments/PlatformSupportHostedButton.jsx", import.meta.url), "utf8");
const ourStoryButton = readFileSync(new URL("../src/components/payments/PayPalDonateButton.jsx", import.meta.url), "utf8");
const googlePay = readFileSync(new URL("../src/components/payments/GooglePayDonationButton.jsx", import.meta.url), "utf8");
const campaignDialog = readFileSync(new URL("../src/components/payments/CampaignDonationDialog.jsx", import.meta.url), "utf8");

test("platform support uses exactly three PayPal-hosted card fields, no raw card inputs", () => {
  assert.match(dialog, /card\.NumberField\(\)/);
  assert.match(dialog, /card\.ExpiryField\(\)/);
  assert.match(dialog, /card\.CVVField\(\)/);
  assert.equal(dialog.match(/card\.\w+Field\(\)/g).length, 3, "exactly three hosted fields");
  assert.doesNotMatch(dialog, /autoComplete="cc-number"|autoComplete="cc-exp"|autoComplete="cc-csc"/);
  assert.doesNotMatch(dialog, /name="cardNumber"|name="card_number"|cardNumber/);
  assert.doesNotMatch(dialog, /type="password"/);
  assert.match(dialog, /PayPal-hosted Card Fields/);
  assert.match(dialog, /no card data touches iFund/i);
});

test("platform support never sends, stores, or attributes a campaign", () => {
  assert.doesNotMatch(dialog, /campaign_id/);
  assert.doesNotMatch(dialog, /campaignId/);
  assert.doesNotMatch(dialog, /donor_id/);
  assert.match(dialog, /no campaign identifier is sent, stored, or/);
  assert.match(dialog, /No portion of this payment is assigned to an individual fundraiser/);
  assert.match(dialog, /not a campaign donation/);
});

test("layout order is amount, card fields, confirm, Google Pay, PayPal", () => {
  const order = [
    dialog.indexOf("Choose your support amount"),
    dialog.indexOf('aria-label="Credit or debit card checkout"'),
    dialog.indexOf('aria-label="Confirm card payment"'),
    dialog.indexOf('aria-label="Google Pay checkout"'),
    dialog.indexOf('aria-label="PayPal checkout"'),
  ];
  assert.ok(order.every(index => index >= 0), "every checkout section must exist");
  assert.ok(order.every((index, i) => i === 0 || index > order[i - 1]), "sections must appear in checkout order");
  assert.match(dialog, /Confirm card payment/);
  assert.doesNotMatch(dialog, /sticky bottom-0/);
  assert.match(dialog, /relative isolate/);
  assert.match(dialog, /env\(safe-area-inset-bottom\)/);
  assert.match(dialog, /aria-pressed=\{Number\(amount\)===value\}/);
});

test("amount validation rejects below-min, above-max, and non-integer cents", () => {
  assert.equal(parseDonationCents("0.99"), null, "below the $1 minimum");
  assert.equal(parseDonationCents("0"), null);
  assert.equal(parseDonationCents("1000000.01"), null, "above the $1,000,000 maximum");
  assert.equal(parseDonationCents("10.005"), null, "fractional cents never round into a charge");
  assert.equal(parseDonationCents("10.5x"), null);
  assert.equal(parseDonationCents(""), null);
  assert.equal(parseDonationCents("25"), 2500);
  assert.equal(parseDonationCents("1"), 100, "$1 minimum is accepted");
  assert.equal(parseDonationCents("1000000"), 100000000, "$1,000,000 maximum is accepted");
  assert.equal(parseDonationCents("5.50"), 550);
  assert.match(dialog, /parseDonationCents\(amount\)/);
  assert.match(dialog, /Enter a valid USD amount \(\$1–\$1,000,000\)/);
  assert.match(dialog, /\[5, 10, 25, 50\]/);
});

test("create-order sends amount, channel, request_key and checkout_token; capture sends the stored token", () => {
  assert.match(dialog, /\/api\/payments\/platform-support\/create-order/);
  assert.match(dialog, /\/api\/payments\/platform-support\/capture-order/);
  assert.match(dialog, /amount_cents: gift/);
  assert.match(dialog, /payment_channel: channel/);
  assert.match(dialog, /request_key: key/);
  assert.match(dialog, /checkout_token: checkoutToken/);
  // 64 lowercase hex: two dash-stripped UUIDs concatenated.
  assert.match(dialog, /crypto\.randomUUID\(\)\.replace\(\/-\/g, ""\) \+ crypto\.randomUUID\(\)\.replace\(\/-\/g, ""\)/);
  // The server-echoed token must match the token that was sent.
  assert.match(dialog, /data\.checkout_token!==checkoutToken/);
  assert.match(dialog, /data\.environment!=="live"/);
  assert.match(dialog, /data\.amount_cents!==gift/);
  assert.match(dialog, /data\.support_id/);
  // The token is stored per order id at create and read back at capture.
  assert.match(dialog, /tokens\.current\.set\(data\.id, checkoutToken\)/);
  assert.match(dialog, /const id = data\?\.orderID, token = tokens\.current\.get\(id\)/);
  assert.match(dialog, /body: JSON\.stringify\(\{ order_id: id, checkout_token: token \}\)/);
  // A retry with the same request_key reuses the same key and token.
  assert.match(dialog, /checkoutTokens\.current\.get\(key\)/);
  assert.match(dialog, /requestKey\(channel\)/);
});

test("capture requires the stored token and records the support receipt", () => {
  assert.match(dialog, /if \(!id \|\| !token\) throw new Error\("This payment needs review/);
  assert.match(dialog, /result\.status!=="captured"/);
  assert.match(dialog, /!result\.support_id \|\| !result\.capture_id/);
  assert.match(dialog, /capture_unverified_check_paypal_before_retry/);
  assert.match(dialog, /Payment confirmation is delayed\. Check your receipt before attempting another payment/);
});

test("receipt state shows the captured amount and the support reference after capture", () => {
  assert.match(dialog, /Support verified with PayPal and recorded\. Thank you!/);
  assert.match(dialog, /Amount supported/);
  assert.match(dialog, /Support reference/);
  assert.match(dialog, /receipt\.supportId/);
  assert.match(dialog, /PayPal capture/);
  assert.match(dialog, /receipt\.captureId/);
  assert.match(dialog, /setReceipt\(\{/);
  assert.match(dialog, /role="status" className="m-5 space-y-3 rounded-2xl border border-emerald-200/);
});

test("guest sends no Authorization header; signed-in sends the Supabase Bearer JWT", () => {
  assert.match(dialog, /authClient\(\)\.auth\.getSession\(\)/);
  assert.match(dialog, /session && !session\.user\?\.is_anonymous/);
  assert.match(dialog, /"authorization": "Bearer " \+ accessToken/);
  assert.match(dialog, /headers: accessToken \? \{ "authorization": "Bearer " \+ accessToken \} : \{\}/);
  // Source files are CRLF on Windows; accept either line ending without
  // weakening the guest/signed-in authorization contract asserted above.
  assert.match(dialog, /A missing\r?\n    \/\/ authenticated session remains an anonymous guest contribution/);
  assert.doesNotMatch(dialog, /donor_id:/);
});

test("hosted fields render independently with per-field fallbacks and wallet decoupling", () => {
  assert.match(dialog, /Promise\.allSettled\(/);
  assert.doesNotMatch(dialog, /Promise\.all\(\[/);
  assert.match(dialog, /fieldErrors/);
  assert.match(dialog, /Card number field could not load/);
  assert.match(dialog, /Expiration field could not load/);
  assert.match(dialog, /Security code field could not load/);
  assert.match(dialog, /setWalletNotice\("PayPal wallet checkout is unavailable/);
  assert.doesNotMatch(dialog, /setError\("PayPal wallet checkout is unavailable/);
  assert.match(dialog, /if\(cancelled\|\|!paypalHost\.current\?\.isConnected\)return;/);
  assert.match(dialog, /return buttons\.render\(paypalHost\.current\)/);
});

test("SDK load failure shows a retry instead of a dead card form", () => {
  assert.match(dialog, /sdkFailed/);
  assert.match(dialog, /Retry secure checkout/);
  assert.match(dialog, /setLoadAttempt\(n=>n\+1\)/);
  assert.match(dialog, /Secure checkout could not load/);
});

test("embedded route unavailable (503, 404, network) falls back to the hosted PayPal link", () => {
  assert.match(dialog, /platform_support_start_unavailable/);
  assert.match(dialog, /isEmbeddedUnavailableError/);
  assert.match(dialog, /error\.code === "platform_support_start_unavailable"/);
  assert.match(dialog, /error\.status === 503 \|\| error\.status === 404/);
  assert.match(dialog, /networkFailure === true/);
  assert.match(dialog, /setEmbeddedUnavailable\(true\)/);
  assert.match(dialog, /Embedded checkout is unavailable right now\./);
  assert.match(dialog, /IFUND_PLATFORM_SUPPORT_PAYMENT_LINK/);
  assert.match(dialog, /Continue to PayPal/);
  assert.match(dialog, /Retry embedded checkout/);
  assert.match(dialog, /rel="noopener noreferrer"/);
  assert.match(dialog, /The amount and payment options are controlled by PayPal/);
});

test("footer button opens the embedded dialog and keeps the hosted link as fallback", () => {
  assert.match(footer, /PlatformSupportDonationDialog/);
  assert.match(footer, /onClick=\{\(\) => setOpen\(true\)\}/);
  assert.match(footer, /<PlatformSupportDonationDialog open=\{open\} onOpenChange=\{setOpen\} \/>/);
  assert.match(footer, /IFUND_PLATFORM_SUPPORT_PAYMENT_LINK/);
  assert.match(footer, /does not fund the/);
  assert.match(footer, /PayPal offers you at checkout/);
  assert.match(footer, /rel="noopener noreferrer"/);
  assert.match(footer, /src="\/images\/paypal-wordmark-color\.svg"/);
  assert.doesNotMatch(footer, /\/api\/payments\/create-order/);
  // The primary CTA is a button, not a straight hosted-link anchor.
  assert.doesNotMatch(footer, /<a href=\{IFUND_PLATFORM_SUPPORT_PAYMENT_LINK\}[^>]*>\s*<img[^>]*>\s*<span>Support IFund<\/span>/);
});

test("OurStory button opens the embedded dialog and keeps the hosted link as fallback", () => {
  assert.match(ourStoryButton, /PlatformSupportDonationDialog/);
  assert.match(ourStoryButton, /setCheckoutOpen\(true\)/);
  assert.match(ourStoryButton, /<PlatformSupportDonationDialog open=\{checkoutOpen\} onOpenChange=\{setCheckoutOpen\} \/>/);
  assert.match(ourStoryButton, /DialogContent/);
  assert.match(ourStoryButton, /IFUND_PLATFORM_SUPPORT_PAYMENT_LINK/);
  assert.match(ourStoryButton, /Choose and review on PayPal/);
  assert.match(ourStoryButton, /do not[\s\S]*campaign receipts or fundraising totals/i);
  assert.match(ourStoryButton, /src="\/images\/paypal-wordmark-color\.svg"/);
  assert.doesNotMatch(ourStoryButton, /\/(api\/payments\/create-order|api\/payments\/capture-order)/);
});

test("Google Pay works for platform support without a fabricated campaign id", () => {
  assert.match(dialog, /<GooglePayDonationButton platformSupport amountCents=\{gift\}/);
  assert.match(googlePay, /platformSupport = false/);
  assert.match(googlePay, /\(!campaignId && !platformSupport\)/);
  assert.match(googlePay, /Interplanetary Fund platform support/);
  assert.match(googlePay, /current\.current\.begin\("googlepay"\)/);
  assert.match(googlePay, /current\.current\.capture\(\{ orderID: orderId \}\)/);
  assert.doesNotMatch(dialog, /<GooglePayDonationButton[^>]*campaignId=/);
});

test("in-dialog campaign tip is untouched and platform support has no tip checkbox", () => {
  assert.doesNotMatch(dialog, /Add 10% optional support/);
  assert.doesNotMatch(dialog, /optional_support_cents/);
  assert.match(campaignDialog, /Add 10% optional support for Interplanetary Fund/);
  assert.match(campaignDialog, /optional_support_cents:tip/);
});
