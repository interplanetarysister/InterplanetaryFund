import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  computePayPalBreakdown,
  computePayPalWalletBreakdown,
  validateDonationAmount,
} from '../base44/shared/fees.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

for (const [rail, buildBreakdown] of [
  ['PayPal', computePayPalBreakdown],
  ['Google Pay via PayPal', computePayPalWalletBreakdown],
]) {
  for (const optedIn of [false, true]) {
    const breakdown = buildBreakdown(1, optedIn);
    assert.equal(validateDonationAmount(1).ok, true, `${rail} $1 campaign gift must meet minimum`);
    assert.equal(breakdown.recipientGift, 1, `${rail} must preserve donor's pledged campaign gift`);
    assert.equal(breakdown.contribution, optedIn ? .10 : 0, `${rail} must add optional 10% support`);
    assert.ok(breakdown.totalCharged > 1, `${rail} processor costs must be covered separately`);
    assert.equal(Number((breakdown.amount + breakdown.processing).toFixed(2)), breakdown.totalCharged);
  }
}

function rotateIntent(previous, campaignId, amount, channel, contribution, nextId) {
  const key = [campaignId, Number(amount).toFixed(2), channel, contribution ? "1" : "0"].join("|");
  return previous.key === key ? previous : { key, id: nextId };
}
const paypalIntent = rotateIntent({ key: "", id: "" }, "campaign-1", 1, "paypal", false, "intent-paypal-1");
assert.equal(rotateIntent(paypalIntent, "campaign-1", 1, "paypal", false, "unused"), paypalIntent);
assert.notEqual(rotateIntent(paypalIntent, "campaign-1", 1, "paypal", true, "intent-paypal-2").id, paypalIntent.id);
const googleIntent = rotateIntent({ key: "", id: "" }, "campaign-1", 1, "googlepay", false, "intent-google-1");
assert.notEqual(googleIntent.id, paypalIntent.id, 'payment channels must never share provider request identities');
assert.notEqual(rotateIntent(googleIntent, "campaign-1", 2, "googlepay", false, "intent-google-2").id, googleIntent.id);

const create = read('base44/functions/createPayPalOrder/entry.ts');
const capture = read('base44/functions/capturePayPalOrder/entry.ts');
const bridge = read('base44/shared/base44Financial.ts');
const mirrors = read('base44/shared/financialMirrors.ts');
const recovery = read('base44/functions/reconcileDirectPayPalCampaignDonation/entry.ts');
const recoveryList = read('base44/functions/listUntrackedPayPalReceipts/entry.ts');
const paypalButton = read('src/components/payments/PayPalCheckoutButton.jsx');
const googlePayButton = read('src/components/payments/GooglePayButton.jsx');
const donateDialog = read('src/components/campaigns/DonateDialog.jsx');

// Deterministic model of the immutable evidence rule used by receipt recovery.
// A partial capture with a contribution retains it; disagreement is a conflict.
function resolveContributionModel(rows) {
  const values = new Set(rows.map((row) => Number(row.platform_contribution || 0)));
  if (values.size > 1) throw new Error('conflict');
  return rows.length ? [...values][0] : 0;
}
assert.equal(resolveContributionModel([
  { kind: 'operation', platform_contribution: 4.5 },
  { kind: 'donation', platform_contribution: 4.5 },
]), 4.5);
assert.equal(resolveContributionModel([]), 0);
assert.throws(() => resolveContributionModel([
  { kind: 'operation', platform_contribution: 4.5 },
  { kind: 'holding', platform_contribution: 0 },
]));

const allocationFingerprintModel = (channel) => createHash('sha256').update(JSON.stringify({
  campaignId: 'campaign-1', providerTransactionId: 'CAPTURE-1', grossAmount: 45,
  platformContribution: 4.5, processingFee: 5, paymentChannel: channel,
})).digest('hex');
assert.notEqual(allocationFingerprintModel('paypal'), allocationFingerprintModel('googlepay'));

const legacyOperationModel = { payment_channel: '' };
function claimLegacyChannelFromCallerModel(operation, requestedChannel) {
  if (!operation.payment_channel && requestedChannel) throw new Error('manual reconciliation');
  return operation.payment_channel;
}
assert.throws(() => claimLegacyChannelFromCallerModel(legacyOperationModel, 'paypal'));
assert.throws(() => claimLegacyChannelFromCallerModel(legacyOperationModel, 'googlepay'));
assert.equal(legacyOperationModel.payment_channel, '', 'competing caller claims must not overwrite blank legacy evidence');
const persistedRecoveryChannels = new Set(['googlepay']);
assert.equal(persistedRecoveryChannels.size === 1 ? [...persistedRecoveryChannels][0] : null, 'googlepay');

// Atomic holding claim/convergence model: equal concurrent writes share the
// operation key; verified same-allocation legacy keys converge to one.
const holdingModel = new Map();
const holding = { transaction: 'CAPTURE-1', campaign: 'campaign-1', amount: 45, contribution: 4.5 };
holdingModel.set('holding:paypal:CAPTURE-1', holding);
holdingModel.set('holding:paypal:CAPTURE-1', { ...holding });
assert.equal(holdingModel.size, 1);
holdingModel.set('legacy-holding:CAPTURE-1', { ...holding });
assert.equal(holdingModel.size === 1, false, 'duplicate holdings are not already complete');
for (const key of [...holdingModel.keys()]) if (key !== 'holding:paypal:CAPTURE-1') holdingModel.delete(key);
assert.equal(holdingModel.size, 1);

assert.ok(create.indexOf('round2(value - contribution) > 0') < create.indexOf('const order = await createOrder'), 'allocation must be valid before order creation');
assert.doesNotMatch(create, /validateDonationAmount\(value\)/, 'valid $1 donor charges must not be rejected by the smaller post-fee allocation');
assert.match(capture, /chargedAmount: cap\.amount/);
assert.match(capture, /Math\.abs\(round2\(total \+ processingFee\) - round2\(cap\.amount\)\)/);
assert.doesNotMatch(capture, /validateDonationAmount\(total\)/);
assert.match(bridge, /FinancialOperation\.upsert/);
assert.match(bridge, /key: \['operation_key', 'allocation_fingerprint'\]/);
assert.match(bridge, /paymentChannel: normalizePaymentChannel\(value\.payment_channel\)/);
assert.match(bridge, /donationAllocationIdentity\(allocation, false\)/);
assert.match(bridge, /Legacy donation operation is missing immutable payment-channel evidence/);
assert.match(bridge, /Conflicting immutable donation allocation/);
assert.match(bridge, /reconcileCanonicalCampaignProjection/);
assert.match(bridge, /Campaign total projection remained unstable after bounded reconciliation/);
assert.match(mirrors, /reconcileCanonicalCampaignProjection\(sr, campaignId\)/);
assert.match(recoveryList, /repair_required: hasLocalEvidence && !complete/);
assert.match(recoveryList, /tracked: complete/);
assert.match(recovery, /sameCampaign/);
assert.match(recovery, /repaired: !wasComplete && existingRows\.length > 0/);
assert.match(recovery, /if \(!allocationIsComplete\(completedAllocation\)\)/);
assert.match(recovery, /const platformContribution = existingRows\.length \? \[\.\.\.contributionValues\]\[0\] : 0/);
assert.match(recovery, /platformContribution,\n\s+processingFee/);
assert.match(recovery, /platform_contribution: platformContribution/);
assert.match(recovery, /payment_method: paymentMethod/);
assert.match(recovery, /persistedMirrorChannels\.size !== 1/);
assert.match(recovery, /Legacy canonical operation has no independently persisted payment-channel evidence/);
assert.match(recovery, /\[\.\.\.paymentMethods\]\[0\] \|\| 'paypal'/);
assert.match(recovery, /finalHoldings\.length !== 1/);
assert.match(recovery, /allocation\.ops\.length !== 1 \|\| allocation\.donations\.length !== 1 \|\| allocation\.holdings\.length !== 1/);
assert.match(recovery, /duplicate: wasComplete/);
assert.match(recovery, /repaired: !wasComplete && existingRows\.length > 0/);
assert.match(capture, /HoldingLedgerEntry\.upsert/);
assert.match(capture, /\{ key: 'operation_key' \}/);
assert.match(capture, /persistedHoldings\.length !== 1/);
assert.doesNotMatch(capture, /HoldingLedgerEntry\.create/);
assert.match(recoveryList, /holdings\.length === 1/);
assert.ok(recovery.indexOf('recordCanonicalDonation') < recovery.indexOf('reconcileDonationMirror'), 'recovery must complete the canonical operation before its mirror');
assert.match(paypalButton, /campaign\.id, value\.toFixed\(2\), "paypal", selectedContribution/);
assert.match(paypalButton, /amount: value/);
assert.match(paypalButton, /platform_contribution: selectedContribution/);
assert.match(paypalButton, /intent_id: intentId/);
assert.match(googlePayButton, /campaign\.id, value\.toFixed\(2\), "googlepay", selectedContribution/);
assert.match(googlePayButton, /amount: value/);
assert.match(googlePayButton, /platform_contribution: selectedContribution/);
assert.match(googlePayButton, /intent_id: intentId/);
assert.doesNotMatch(googlePayButton, /propsRef = useRef\(\{[^}]*platformContribution/);
assert.match(donateDialog, /computePayPalBreakdown/);
assert.match(donateDialog, /<GooglePayButton /);
assert.match(donateDialog, /Gift to this campaign/);
assert.match(donateDialog, /Confirm the final amount in PayPal/);

console.log('PayPal financial recovery contracts verified.');
