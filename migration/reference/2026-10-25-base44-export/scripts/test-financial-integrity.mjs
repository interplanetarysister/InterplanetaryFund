// Cross-path financial-integrity release contracts.
// These are static invariants that prevent accidental return to split Base44
// financial writes. They complement, but do not replace, runtime provider and
// Base44 runtime/provider verification.
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(p, 'utf8');
const files = {
  bridge: read('base44/shared/base44Financial.ts'),
  mirrors: read('base44/shared/financialMirrors.ts'),
  manual: read('base44/functions/recordDonation/entry.ts'),
  grants: read('base44/functions/decideGrantApplication/entry.ts'),
  stripe: read('base44/functions/stripeWebhook/entry.ts'),
  paypalCapture: read('base44/functions/capturePayPalOrder/entry.ts'),
  paypal: read('base44/shared/paypal.ts'),
  withdrawal: read('base44/functions/requestWithdrawal/entry.ts'),
  kofi: read('base44/functions/kofiWebhook/entry.ts'),
  externalSync: read('base44/functions/syncExternalFunds/entry.ts'),
  donationSchema: read('base44/entities/Donation.jsonc'),
  notificationSchema: read('base44/entities/Notification.jsonc'),
  inboxSchema: read('base44/entities/InboxItem.jsonc'),
  withdrawalSchema: read('base44/entities/Withdrawal.jsonc'),
  webhookSchema: read('base44/entities/WebhookEvent.jsonc'),
  paypalRecovery: read('base44/functions/reconcileDirectPayPalCampaignDonation/entry.ts'),
  paypalRecoveryList: read('base44/functions/listUntrackedPayPalReceipts/entry.ts'),
  paypalRawButton: read('src/components/payments/PayPalDonateButton.jsx'),
  distribution: read('base44/functions/generateDistributionContent/entry.ts'),
  distributionDestination: read('base44/shared/distributionDestination.js'),
};

const checks = [
  ['Base44 financial boundary uses FinancialOperation', files.bridge.includes('sr.entities.FinancialOperation')],
  ['Base44 financial boundary records donations', files.bridge.includes("operation_type: 'donation'")],
  ['canonical donations use atomic immutable keyed upsert', files.bridge.includes('FinancialOperation.upsert') && files.bridge.includes("key: ['operation_key', 'allocation_fingerprint']")],
  ['canonical donation fingerprint includes normalized payment channel', files.bridge.includes('paymentChannel: normalizePaymentChannel(value.payment_channel)')],
  ['legacy channel-less canonical operations reject caller-driven backfill', files.bridge.includes('Legacy donation operation is missing immutable payment-channel evidence')],
  ['conflicting immutable donation allocations fail closed', files.bridge.includes('Conflicting immutable donation allocation')],
  ['Base44 financial boundary reserves withdrawals', files.bridge.includes("operation_type: 'withdrawal_reservation'")],
  ['Base44 financial boundary completes reserved withdrawals', files.bridge.includes("op.state !== 'reserved'") && files.bridge.includes("state: 'completed'")],
  ['Base44 financial boundary cancels withdrawals', files.bridge.includes("state: 'cancelled'")],
  ['Base44 financial boundary records external observations separately', files.bridge.includes("operation_type: 'external_observation'")],
  ['Base44 campaign totals require explicit payment verification', files.bridge.includes('d.payment_verified === true')],
  ['Base44 available balance excludes already-withdrawn funds', files.bridge.includes('!d.withdrawal_id')],
  ['Base44 financial baseline fails closed at batch limit', files.bridge.includes('Campaign financial baseline exceeds the safe batch size')],

  ['manual gifts use canonical donation boundary', files.manual.includes('recordCanonicalDonation')],
  ['manual gifts are pending until verified', files.manual.includes('paymentVerified: false')],
  ['manual gifts do not increment Base44 campaign money', !/\$inc\s*:\s*\{[^}]*raised_amount/.test(files.manual)],

  ['institutional awards use canonical pending boundary', files.grants.includes('recordCanonicalDonation') && files.grants.includes('paymentVerified: false')],
  ['institutional awards do not create Base44 Donation directly', !/entities\.Donation\.create/.test(files.grants)],
  ['institutional awards do not increment campaign money', !/\$inc\s*:\s*\{[^}]*raised_amount/.test(files.grants)],

  ['PayPal capture uses canonical donation boundary', files.paypalCapture.includes('recordCanonicalDonation')],
  ['PayPal capture does not increment Base44 campaign money', !/\$inc\s*:\s*\{[^}]*raised_amount/.test(files.paypalCapture)],
  ['PayPal capture atomically claims and verifies one holding entry', files.paypalCapture.includes('HoldingLedgerEntry.upsert') && files.paypalCapture.includes("{ key: 'operation_key' }") && files.paypalCapture.includes('persistedHoldings.length !== 1')],
  ['PayPal capture has stable provider request id', files.paypal.includes('PayPal-Request-Id') && files.paypal.includes('IF_CAPTURE')],
  ['PayPal payout sender batch is deterministic', files.paypal.includes("stableProviderKey('IFW', itemId") && !files.paypal.includes('IFW_${Date.now()}')],
  ['PayPal ambiguous transport result is explicit', files.paypal.includes('err.ambiguous = true')],
  ['PayPal transaction reporting exposes processor fee for reconciliation', files.paypal.includes('fee_amount') && files.paypal.includes('feeAmount')],
  ['verified Donation mirror is created before campaign totals are recomputed',
    files.mirrors.indexOf('const mirror = await reconcileOne(sr.entities.Donation') >= 0 &&
    files.mirrors.indexOf('const mirror = await reconcileOne(sr.entities.Donation') <
    files.mirrors.indexOf('await reconcileCanonicalCampaignProjection(sr, campaignId)')],
  ['campaign total projection uses bounded convergence', files.bridge.includes('reconcileCanonicalCampaignProjection') && files.bridge.includes('remained unstable after bounded reconciliation')],
  ['PayPal capture never mirrors stale campaign totals before donation convergence', !files.paypalCapture.includes('await mirrorCanonicalCampaignTotal')],
  ['legacy PayPal recovery accepts only donation-payment T0013 receipts', files.paypalRecovery.includes("tx.transactionEventCode !== 'T0013'") && files.paypalRecoveryList.includes("tx.transactionEventCode === 'T0013'")],
  ['legacy PayPal recovery deduplicates by provider transaction id', files.paypalRecovery.includes('provider_transaction_id: transactionId') && files.paypalRecovery.includes('existingAllocation')],
  ['legacy PayPal recovery enters canonical donation boundary', files.paypalRecovery.includes('recordCanonicalDonation') && files.paypalRecovery.includes('reconcileDonationMirror')],
  ['partial PayPal receipt state remains repairable', files.paypalRecoveryList.includes('repair_required: hasLocalEvidence && !complete') && files.paypalRecovery.includes('repaired: !wasComplete')],
  ['PayPal partial recovery preserves immutable contribution and channel', files.paypalRecovery.includes('platform_contribution: platformContribution') && files.paypalRecovery.includes('payment_method: paymentMethod')],
  ['PayPal legacy channel backfill requires persisted mirror evidence', files.paypalRecovery.includes('persistedMirrorChannels.size !== 1') && files.paypalRecovery.includes('independently persisted payment-channel evidence')],
  ['PayPal receipt completion requires one holding', files.paypalRecoveryList.includes('holdings.length === 1')],
  ['PayPal recovery duplicate status requires exactly one complete operation/mirror/holding', files.paypalRecovery.includes('allocation.ops.length !== 1') && files.paypalRecovery.includes('allocation.donations.length !== 1') && files.paypalRecovery.includes('allocation.holdings.length !== 1')],
  ['platform PayPal support remains available in both fundraising modes', files.paypalRawButton.includes('generatePayPalLink') && !files.paypalRawButton.includes('if (!PRELAUNCH_MODE) return null')],
  ['campaign distribution never uses raw PayPal donate URLs',
    !files.distribution.includes('paypal.com/donate') &&
    !files.distributionDestination.includes('paypal.com/donate') &&
    files.distributionDestination.includes('?donate=true')],

  ['Stripe uses canonical donation boundary', files.stripe.includes('recordCanonicalDonation')],
  ['Stripe never directly creates Base44 Donation', !/entities\.Donation\.create/.test(files.stripe)],
  ['Stripe never increments Base44 campaign money', !/\$inc\s*:\s*\{[^}]*raised_amount/.test(files.stripe)],

  ['withdrawal seeds baseline before local reservations', files.withdrawal.indexOf('await ensureCanonicalCampaign(sr, campaign)') < files.withdrawal.indexOf("$set: { withdrawal_id: withdrawal.id }")],
  ['withdrawal uses canonical reservation', files.withdrawal.includes('reserveCanonicalWithdrawal')],
  ['withdrawal completes canonical reservation after provider payout', files.withdrawal.includes('completeCanonicalWithdrawal')],
  ['withdrawal can cancel canonical reservation', files.withdrawal.includes('cancelCanonicalWithdrawal')],
  ['ambiguous payout status keeps funds reserved', files.withdrawal.includes("status: 'provider_status_unknown'") && files.withdrawal.includes('funds remain reserved')],
  ['provider-accepted/canonical-failed payout enters reconciliation', files.withdrawal.includes("status: 'reconciliation_pending'")],
  ['reservation release requires explicit provider non-payment confirmation', files.withdrawal.includes('confirm_not_paid !== true')],

  ['Ko-fi uses canonical external observation, not withdrawable donation', files.kofi.includes('recordCanonicalExternalObservation') && files.kofi.includes('external_only: true')],
  ['Ko-fi prefers provider message_id', files.kofi.includes('payload.message_id')],
  ['Ko-fi never creates Base44 Donation', !/entities\.Donation\.create/.test(files.kofi)],
  ['Ko-fi never increments campaign money', !/\$inc\s*:\s*\{[^}]*raised_amount/.test(files.kofi)],
  ['Ko-fi sets absolute observed external total', files.kofi.includes('external_total: Number(observation.observedTotal')],
  ['Ko-fi prevents mixed-currency totals', files.kofi.includes('Currency conversion/reconciliation required')],

  ['generic external sync records observations only', files.externalSync.includes('recordCanonicalExternalObservation')],
  ['generic external sync creates no Base44 Donation', !/entities\.Donation\.create/.test(files.externalSync)],
  ['generic external sync does not increment campaign money', !/\$inc\s*:\s*\{[^}]*raised_amount/.test(files.externalSync)],
  ['generic external sync explicitly imports zero withdrawable money', files.externalSync.includes('withdrawable_imported: 0')],

  ['Donation mirrors have canonical operation id', files.donationSchema.includes('canonical_operation_id')],
  ['Notification mirrors have canonical operation id', files.notificationSchema.includes('canonical_operation_id')],
  ['Inbox mirrors have canonical operation id', files.inboxSchema.includes('canonical_operation_id')],
  ['Withdrawal schema has canonical reservation id', files.withdrawalSchema.includes('canonical_reservation_id')],
  ['Withdrawal schema supports provider-status-unknown', files.withdrawalSchema.includes('provider_status_unknown')],
  ['Withdrawal schema supports reconciliation-pending', files.withdrawalSchema.includes('reconciliation_pending')],
  ['Webhook schema preserves financial recovery stages', files.webhookSchema.includes('financial_applied') && files.webhookSchema.includes('side_effects_complete') && files.webhookSchema.includes('failed')],
  ['mirror helper reconciles inbox/notification/donation by canonical operation id', files.mirrors.includes('reconcileInboxMirror') && files.mirrors.includes('reconcileNotificationMirror') && files.mirrors.includes('reconcileDonationMirror')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) { console.error(`FAIL ${name}`); failed++; }
  else console.log(`ok  ${name}`);
}

if (failed) {
  console.error(`\n${failed} financial-integrity contract test(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} financial-integrity contract tests passed.`);
