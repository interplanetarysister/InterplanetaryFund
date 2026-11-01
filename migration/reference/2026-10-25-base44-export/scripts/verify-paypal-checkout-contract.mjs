import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const dialog=read("src/components/campaigns/DonateDialog.jsx");
const button=read("src/components/payments/PayPalCheckoutButton.jsx");
const scripts=read("src/components/payments/paypalScripts.js");
const capture=read("base44/functions/capturePayPalOrder/entry.ts");
const create=read("base44/functions/createPayPalOrder/entry.ts");
const prelaunchAccess=read("base44/shared/prelaunchPayments.ts");
const mirrors=read("base44/shared/financialMirrors.ts");
const rawButton=read("src/components/payments/PayPalDonateButton.jsx");
const fundingCard=read("src/components/campaigns/CampaignFundingCard.jsx");
const distribution=read("base44/functions/generateDistributionContent/entry.ts");
const distributionDestination=read("base44/shared/distributionDestination.js");
const recoveryList=read("base44/functions/listUntrackedPayPalReceipts/entry.ts");
const recovery=read("base44/functions/reconcileDirectPayPalCampaignDonation/entry.ts");
const paypal=read("base44/shared/paypal.ts");
const bridge=read("base44/shared/base44Financial.ts");
assert.match(dialog,/PayPalCheckoutButton/);
assert.match(dialog,/Give with PayPal/);
assert.match(dialog,/paypal\?\.api_live === true/);
assert.doesNotMatch(dialog,/stripeAvailable|startStripeCheckout|createDonationCheckout/, "Retired Stripe checkout is not offered to donors");
assert.match(button,/createPayPalOrder/);
assert.match(button,/capturePayPalOrder/);
assert.match(button,/result\?\.ok !== true/);
assert.match(button,/data\?\.orderID/);
assert.match(button,/campaign\.id, value\.toFixed\(2\), "paypal", selectedContribution/);
assert.match(button,/amount: value/);
assert.match(button,/platform_contribution: selectedContribution/);
assert.match(button,/intent_id: intentId/);
assert.doesNotMatch(button,/\.message\b/,"provider exception messages must not reach PayPal UI");
assert.match(scripts,/components=buttons,googlepay,applepay&/);
assert.doesNotMatch(scripts,/googlepay-payments/, "v5 PayPal Buttons cannot load a v6 SDK component");
assert.match(scripts,/window\.paypal\?\.Buttons/);
const wallet=read("src/components/payments/GooglePayButton.jsx");
assert.match(wallet,/window\.paypal\?\.Googlepay/);
assert.match(wallet,/paypal\.Googlepay\(\)/);
assert.match(wallet,/paypalGooglePay\.confirmOrder/);
assert.match(wallet,/confirmation\?\.status === "PAYER_ACTION_REQUIRED"/);
assert.match(wallet,/onReadyChange\?\.\(true\)/);
assert.match(wallet,/campaign\.id, value\.toFixed\(2\), "googlepay", selectedContribution/);
assert.match(wallet,/amount: value/);
assert.match(wallet,/platform_contribution: selectedContribution/);
assert.match(wallet,/intent_id: intentId/);
assert.doesNotMatch(wallet,/propsRef = useRef\(\{[^}]*platformContribution/);
assert.doesNotMatch(wallet,/paypal\.createInstance/);
assert.match(scripts,/window\.paypal\?\.Buttons/);
assert.match(capture,/paymentChannel === 'googlepay' \? 'Google Pay' : paymentChannel === 'applepay' \? 'Apple Pay' : 'PayPal'/);
assert.match(create,/PAYPAL_MODE.*live/);
assert.match(capture,/PAYPAL_MODE.*live/);
assert.match(capture,/Google Pay/);
assert.match(capture,/payment_method: paymentChannel/);
assert.match(capture,/HoldingLedgerEntry\.upsert/);
assert.match(capture,/persistedHoldings\.length !== 1/);
assert.match(create,/payment_channel/);
assert.doesNotMatch(create,/validateDonationAmount\(value\)/);
assert.match(create,/campaignPaymentAccess\(base44\)/);
// A previously created order is finalized even if new checkouts are switched off.
assert.doesNotMatch(capture,/campaignPaymentAccess\(base44\)/);
assert.match(capture,/recordCanonicalDonation\(sr/);
assert.match(prelaunchAccess,/isPublicCampaignFundraisingEnabled/);
assert.doesNotMatch(prelaunchAccess,/SUPER_ADMIN_OWNER_EMAILS/);
assert.match(fundingCard,/usePublicCampaignFundraising/);
assert.match(dialog,/usePublicCampaignFundraising/);
assert.doesNotMatch(rawButton,/if \(!PRELAUNCH_MODE\) return null/);
assert.match(rawButton,/generatePayPalLink/);
assert.doesNotMatch(distribution,/paypal\.com\/donate/,"campaign distribution must never bypass IFund checkout");
assert.doesNotMatch(distributionDestination,/paypal\.com\/donate/,"canonical campaign destinations must never bypass IFund checkout");
assert.match(distributionDestination,/\/campaign\/\$\{encodeURIComponent\(campaignId\)\}\?donate=true/);
assert.match(mirrors,/const mirror = await reconcileOne\(sr\.entities\.Donation/);
assert.ok(
  mirrors.indexOf("const mirror = await reconcileOne(sr.entities.Donation") <
  mirrors.indexOf("await reconcileCanonicalCampaignProjection(sr, campaignId)"),
  "campaign totals must be recomputed only after the verified Donation mirror exists"
);
assert.doesNotMatch(capture,/await mirrorCanonicalCampaignTotal/,"PayPal capture must not mirror stale totals before donation convergence");
assert.match(recoveryList,/transactionEventCode === 'T0013'/);
assert.match(recovery,/tx\.transactionEventCode !== 'T0013'/);
assert.match(recovery,/paypal:legacy-direct:/);
assert.match(recovery,/provider_transaction_id: transactionId/);
assert.match(recovery,/reconcileDonationMirror/);
assert.match(paypal,/https:\/\/api-m\.paypal\.com/);
assert.match(paypal,/https:\/\/api-m\.sandbox\.paypal\.com/);
assert.doesNotMatch(paypal,/https:\/\/api\.paypal\.com/);
assert.doesNotMatch(paypal,/https:\/\/api\.sandbox\.paypal\.com/);
assert.match(recovery,/repaired: !wasComplete/);
assert.match(recovery,/platform_contribution: platformContribution/);
assert.match(recovery,/payment_method: paymentMethod/);
assert.match(recoveryList,/repair_required: hasLocalEvidence && !complete/);
assert.match(recoveryList,/holdings\.length === 1/);
assert.match(recoveryList,/Donation\.filter\(\{ payment_method: 'googlepay' \}/);
assert.match(recoveryList,/donations\.length === 1/);
assert.match(recoveryList,/source_account_ref === IFUND_PAYPAL_ACCOUNT_REF/);
assert.match(capture,/cap\.capture_status !== 'COMPLETED'/);
assert.match(capture,/!cap\.capture_id/);
assert.ok(
  capture.indexOf("existingOperations.length") < capture.indexOf("resolvePayPalCaptureAllocation({"),
  "an existing canonical allocation must be frozen before provider enrichment is resolved"
);
assert.ok(
  capture.indexOf("existingOperations.length") < capture.indexOf("recordCanonicalDonation(sr"),
  "same-order retries must validate the canonical operation before claiming another allocation"
);
assert.match(capture,/savedChannel === paymentChannel/);
assert.match(bridge,/FinancialOperation\.upsert/);
assert.match(bridge,/key: \['operation_key', 'allocation_fingerprint'\]/);
assert.match(bridge,/paymentChannel: normalizePaymentChannel\(value\.payment_channel\)/);
assert.match(bridge,/Legacy donation operation is missing immutable payment-channel evidence/);
assert.match(paypal,/feeAmount/);
assert.match(paypal,/fee_amount/);
assert.match(paypal,/export async function getOrder\(orderId\)/);
assert.match(paypal,/\/v2\/checkout\/orders\/\$\{encodeURIComponent\(id\)\}/);
assert.match(paypal,/recovered_after_capture_error: true/);
assert.match(paypal,/recovered\.status === 'COMPLETED'/);
assert.match(paypal,/recovered\.capture_status === 'COMPLETED'/);
assert.match(paypal,/recovered\.capture_id/);
assert.match(paypal,/recovered\.amount > 0/);
console.log("PayPal campaign checkout contract verified.");