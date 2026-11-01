import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { subscriptionPrice, providerPriceIsExact } from '../base44/shared/subscriptionCatalog.js';

const src = (path) => readFileSync(path, 'utf8');
const expected = subscriptionPrice('basic', 'monthly');
assert.equal(expected.amount_cents, 1200);
assert.equal(expected.currency, 'USD');
const supplied = 'P-6YD2273006199630KNLDXBLA';
assert.match(supplied, /^P-[A-Z0-9]{20,32}$/);
const plan = {
  id: supplied, product_id: 'PROD-TEST1234', status: 'ACTIVE',
  billing_cycles: [{
    tenure_type: 'REGULAR',
    frequency: { interval_unit: 'MONTH', interval_count: 1 },
    total_cycles: 0,
    pricing_scheme: { fixed_price: { currency_code: 'USD', value: '12.00' } },
  }],
};
assert.equal(providerPriceIsExact(plan, expected), true);
assert.equal(providerPriceIsExact({ ...plan, status: 'INACTIVE' }, expected), false);
assert.equal(providerPriceIsExact({ ...plan, billing_cycles: [{ ...plan.billing_cycles[0], pricing_scheme: { fixed_price: { currency_code: 'USD', value: '13.00' } } }] }, expected), false);
assert.equal(providerPriceIsExact({ ...plan, billing_cycles: [{ ...plan.billing_cycles[0], frequency: { interval_unit: 'YEAR', interval_count: 1 } }] }, expected), false);

const registry = src('base44/functions/verifyOwnerPayPalBasicPlan/entry.ts');
const shared = src('base44/shared/paypalSubscriptions.ts');
const bulk = src('base44/functions/syncPayPalSubscriptionCatalog/entry.ts');
assert.ok(shared.includes(supplied), 'the authoritative shared catalog contains the owner-supplied plan');
assert.match(registry, /IFUND_OWNER_BASIC_MONTHLY_PLAN_ID/);
assert.match(bulk, /IFUND_OWNER_BASIC_MONTHLY_PLAN_ID/);
assert.match(bulk, /getPayPalBillingPlan\(ownerBasicMonthlyId\)/);
assert.match(bulk, /adopted_existing_and_verified/);
assert.match(bulk, /supplied\?\.id === ownerBasicMonthlyId/);
assert.match(bulk, /providerPriceIsExact\(supplied, expected\) && supplied\.product_id/);
assert.match(bulk, /row\.plan_id === ownerBasicMonthlyId && \(row\.tier !== expected\.tier \|\| row\.interval !== expected\.interval\)/);
assert.match(bulk, /SubscriptionPlanMapping\.filter\(\{ provider: 'paypal', account_ref: IFUND_PAYPAL_ACCOUNT_REF \}\)/);
assert.match(bulk, /paypalBillingRequest\('\/v1\/catalogs\/products'/);
assert.match(bulk, /paypalBillingRequest\('\/v1\/billing\/plans'/);
assert.match(bulk, /product_id: productId/);
assert.match(bulk, /interval_unit: expected\.interval === 'monthly' \? 'MONTH' : 'YEAR'/);
assert.match(bulk, /value: \(expected\.amount_cents \/ 100\)\.toFixed\(2\), currency_code: 'USD'/);
assert.match(bulk, /const verified = await getPayPalBillingPlan\(plan\.id\)/);
assert.match(bulk, /!providerPriceIsExact\(verified, expected\) \|\| verified\.product_id !== productId/);
assert.match(bulk, /account_ref: IFUND_PAYPAL_ACCOUNT_REF/);
assert.match(bulk, /status: 'created_and_verified'/);
assert.match(bulk, /SubscriptionPlanMapping\.update\(existing\.id/);
assert.match(shared, /secrets\.get\('PAYPAL_CLIENT_ID'\)/);
assert.match(shared, /secrets\.get\('PAYPAL_CLIENT_SECRET'\)/);
assert.match(shared, /const BASE = 'https:\/\/api-m\.paypal\.com'/);
assert.match(registry, /getPayPalBillingPlan\(PROVIDED_BASIC_MONTHLY_PLAN_ID\)/);
assert.match(registry, /providerPriceIsExact\(plan, expected\)/);
assert.match(registry, /assertActiveAccount\(base44\)/);
assert.match(registry, /guard\.user\.role !== 'admin'/);
assert.doesNotMatch(registry, /\/v1\/billing\/subscriptions/);
assert.doesNotMatch(registry, /\/v1\/catalogs\/products/);
assert.doesNotMatch(registry, /\/v1\/billing\/plans'/);

const ui = src('src/pages/Subscriptions.jsx');
assert.match(ui, /verifyOwnerPayPalBasicPlan/);
assert.match(ui, /setupPayPalSubscriptionWebhook/);
assert.match(ui, /activateSubscriptionCheckout/);
assert.doesNotMatch(ui, /paypal\.Buttons\s*\(/);
const checkout = src('base44/functions/createPayPalSubscriptionCheckout/entry.ts');
assert.match(checkout, /verifiedPayPalPlan/);
assert.match(checkout, /PayPalSubscriptionIntent\.create/);
const reconcile = src('base44/shared/paypalSubscriptionReconcile.ts');
assert.match(reconcile, /hasVerifiedPayment/);
assert.match(reconcile, /subscription_status: 'active'/);
console.log('Owner-provided $12/month PayPal plan mapping contract verified (offline; live merchant verification still required).');
