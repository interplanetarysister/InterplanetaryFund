// Stripe has been retired as a NEW payment processor for IFund. Historic
// signed webhooks, refunds, disputes, and canonical ledger entries stay intact.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(p, 'utf8');
const retired = [
  'base44/functions/createSubscriptionCheckout/entry.ts',
  'base44/functions/createPremiumDayPassCheckout/entry.ts',
  'base44/functions/createDonationCheckout/entry.ts',
  'base44/functions/syncStripeSubscriptionCatalog/entry.ts',
  'base44/functions/startStripeConnectOnboarding/entry.ts',
];
for (const file of retired) {
  const source = read(file);
  assert.match(source, /status: 410/, file + ' must reject new Stripe use');
  assert.doesNotMatch(source, /checkout\.sessions\.create|stripe\.products\.create|stripe\.prices\.create|stripe\.accounts\.create/);
}
const frontends = [
  'src/pages/Subscriptions.jsx', 'src/components/campaigns/DonateDialog.jsx',
  'src/pages/Withdrawals.jsx', 'src/pages/Platform.jsx',
];
for (const file of frontends) assert.doesNotMatch(read(file), /Stripe|stripe/, file + ' exposes retired payment provider');
assert.doesNotMatch(read('base44/functions/getPaymentCapabilities/entry.ts'), /stripe:/);
const paypalOptions = read('base44/functions/getPayPalSubscriptionOptions/entry.ts');
assert.match(paypalOptions, /verifiedPayPalPlan/);
assert.match(paypalOptions, /isLivePayPalRestReady/);
assert.match(read('base44/shared/liveProviderReadiness.ts'), /stripe_checkout: settled\(false/);
const webhook = read('base44/functions/stripeWebhook/entry.ts');
assert.match(webhook, /StripeReversalHold\.create/);
assert.match(webhook, /reconcileCanonicalCampaignProjection/);
assert.match(webhook, /STRIPE_REVERSAL_HOLD/);
assert.match(read('base44/functions/getStripeSubscriptionOptions/entry.ts'), /retired: true/);
assert.match(read('base44/functions/getCryptoDonationReadiness/entry.ts'), /verified_checkout_live: false/);
console.log('PASS: Stripe checkout retired, PayPal offered, historical Stripe refund/ledger reconciliation retained.');
