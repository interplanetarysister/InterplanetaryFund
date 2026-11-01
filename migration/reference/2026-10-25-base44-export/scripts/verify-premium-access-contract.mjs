import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripePriceFor } from '../base44/shared/subscriptionCatalog.js';
const read = path => readFileSync(path, 'utf8');
const client = read('src/lib/subscriptionEntitlements.js');
const server = read('base44/shared/subscriptionEntitlements.ts');
const trial = read('base44/functions/startPremiumTrial/entry.ts');
const pass = read('base44/functions/createPremiumDayPassCheckout/entry.ts');
const webhook = read('base44/functions/stripeWebhook/entry.ts');
const checkout = read('base44/functions/createSubscriptionCheckout/entry.ts');
const ui = read('src/pages/Subscriptions.jsx');
const catalog = read('base44/shared/premiumAccessCatalog.ts');
const schema = JSON.parse(read('base44/entities/User.jsonc'));
assert.equal(stripePriceFor('basic', 'monthly'), 'price_1UOFDfGg5Dyxp347qGlvjDcY');
for (const field of ['premium_trial_started_at','premium_day_pass_expires_at',
  'stripe_day_pass_checkout_id','stripe_day_pass_payment_intent','stripe_subscription_id']) {
  assert.ok(schema.properties[field], 'User schema missing ' + field);
}
for (const code of [client, server]) {
  assert.match(code, /user\?\.role === ['"]admin['"]/);
  assert.match(code, /premium_trial_started_at/);
  assert.match(code, /trial_end/);
  assert.match(code, /premium_day_pass_expires_at/);
  assert.match(code, /Date\.now\(\)/, 'Time-bound access must be checked at usage time');
}
assert.match(trial, /req\.method !== 'POST'/);
assert.match(trial, /assertActiveAccount/);
assert.match(trial, /premium_trial_started_at/);
assert.match(trial, /trial_end/);
assert.match(trial, /renewal_scheduled: false/);
assert.doesNotMatch(trial, /checkout\.sessions\.create|subscriptions\.create|charges\.create/);
assert.match(pass, /status: 410/, 'Retired Stripe day pass cannot accept payments');
assert.match(webhook, /ifund_purchase === 'premium_day_pass'/);
assert.match(webhook, /confirmed\.payment_status !== 'paid'/);
assert.match(webhook, /stripe\.checkout\.sessions\.listLineItems/);
assert.match(webhook, /intent\?\.status === 'succeeded'/);
assert.match(webhook, /verifiedDayPassPrice\(price\)/);
assert.match(webhook, /event\.created \* 1000 \+ DAY_PASS_DURATION_MS/);
assert.match(webhook, /stripe_day_pass_payment_intent: intent\.id/);
assert.match(webhook, /passHolders/);
assert.match(webhook, /u\.stripe_subscription_id === sub\.id/);
assert.match(checkout, /status: 410/, 'Retired Stripe subscription checkout cannot accept payments');
assert.match(ui, /startPremiumTrial/);
assert.match(ui, /createPayPalSubscriptionCheckout/);
assert.doesNotMatch(ui, /Stripe|stripe|createPremiumDayPassCheckout/, 'Subscription page must not initiate Stripe payments');
assert.match(catalog, /price_1UOFDgGg5Dyxp347qHsT4r7m/);
console.log('PASS: PayPal subscription UI, free trial, retired day-pass purchase, historical Stripe expiry/refund accounting.');