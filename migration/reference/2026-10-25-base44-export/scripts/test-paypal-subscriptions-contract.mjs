import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SUBSCRIPTION_PRICING, subscriptionPrices, subscriptionPrice, providerPriceIsExact, stripePriceFor } from '../base44/shared/subscriptionCatalog.js';

const prices = subscriptionPrices();
assert.equal(prices.length, 10);
assert.deepEqual(Object.keys(SUBSCRIPTION_PRICING), ['basic', 'outreach', 'professional', 'enterprise', 'nonprofit']);
const amounts = { basic:[1200,11500],outreach:[4900,47000],professional:[9900,95000],enterprise:[19900,191000],nonprofit:[2900,28000] };
for (const [tier,values] of Object.entries(amounts)) {
  for (const [i,interval] of ['monthly','annual'].entries()) {
    const price = subscriptionPrice(tier,interval);
    assert.equal(price.amount_cents,values[i]);
    const providerPlan = {
      status:'ACTIVE',
      billing_cycles:[{
        tenure_type:'REGULAR',total_cycles:0,frequency:{interval_unit:i?'YEAR':'MONTH',interval_count:1},
        pricing_scheme:{fixed_price:{currency_code:'USD',value:(values[i]/100).toFixed(2)}},
      }],
    };
    assert.equal(providerPriceIsExact(providerPlan,price),true);
    assert.equal(providerPriceIsExact({...providerPlan,status:'INACTIVE'},price),false);
    assert.equal(providerPriceIsExact({...providerPlan,billing_cycles:[{
      ...providerPlan.billing_cycles[0],
      pricing_scheme:{fixed_price:{currency_code:'USD',value:((values[i]+100)/100).toFixed(2)}},
    }]},price),false);
  }
}
assert.equal(subscriptionPrice('free','monthly'),null);
assert.equal(subscriptionPrice('enterprise','weekly'),null);
assert.equal(stripePriceFor('basic','monthly'),'price_1UOFDfGg5Dyxp347qGlvjDcY');
assert.equal(stripePriceFor('enterprise','monthly'),'price_1UOhK5Gg5Dyxp347ZtrOMWJl');

const src = name => readFileSync(name,'utf8');
const page=src('src/pages/Subscriptions.jsx');
const stripeCheckout=src('base44/functions/createSubscriptionCheckout/entry.ts');
const paypalCheckout=src('base44/functions/createPayPalSubscriptionCheckout/entry.ts');
const paypalReconcile=src('base44/shared/paypalSubscriptionReconcile.ts');
const webhook=src('base44/functions/payPalSubscriptionWebhook/entry.ts');
const setup=src('base44/functions/setupPayPalSubscriptionWebhook/entry.ts');
const admin=src('base44/functions/syncPayPalSubscriptionCatalog/entry.ts');
assert.match(page,/createPayPalSubscriptionCheckout/);
assert.match(page,/confirmPayPalSubscription/);
assert.match(page,/syncPayPalSubscriptionCatalog/);
assert.match(page,/setupPayPalSubscriptionWebhook/);
assert.match(stripeCheckout,/status: 410/, 'Retired Stripe checkout cannot charge customers');
assert.doesNotMatch(page,/stripe/i, 'Subscription screen must offer PayPal, not Stripe');
const paypalOptions = src('base44/functions/getPayPalSubscriptionOptions/entry.ts');
assert.match(paypalOptions,/verifiedPayPalPlan/);
assert.match(paypalOptions,/isLivePayPalRestReady/);
assert.match(src('base44/functions/activateSubscriptionCheckout/entry.ts'),/scope: 'beta'/);
assert.match(paypalCheckout,/verifiedPayPalPlan/);
assert.match(paypalCheckout,/PayPalSubscriptionIntent\.create/);
assert.match(paypalCheckout,/subscription_status === 'active'/);
assert.match(paypalReconcile,/last_payment/);
assert.match(paypalReconcile,/paidCents === verified\.expected\.amount_cents/);
assert.match(paypalReconcile,/intent\.created_at/);
assert.match(paypalReconcile,/last_reversal_at/);
assert.match(paypalReconcile,/user\.role === 'admin'/);
assert.match(webhook,/verifyWebhookSignature/);
assert.match(webhook,/reconcilePayPalSubscription/);
assert.match(webhook,/PAYMENT\.SALE\.REFUNDED/);
assert.match(webhook,/PAYMENT\.SALE\.COMPLETED/);
assert.match(setup, /stage = 'validate_callback_url'/);
assert.match(setup, /new globalThis\.URL\(URL\)/, 'callback must use URL constructor, not the shadowing URL string');
assert.doesNotMatch(setup, /new URL\(URL\)/, 'callback URL constant must never shadow the URL constructor');
assert.match(setup, /stage = 'verify_registered_webhook'/);
assert.match(setup, /remote\?\.url !== URL/);
assert.match(setup, /grantedEvents\.has/);
assert.match(setup,/payPalSubscriptionWebhook/);
assert.match(admin,/admin\.role !== 'admin'/);
assert.match(admin,/providerPriceIsExact/);
assert.equal(prices.every(p => p.currency==='USD'),true);
console.log('PASS: 10 USD PayPal billing prices, 5 products, monthly/annual cadence, provider verification, webhook events, owner binding, retired Stripe checkout and admin provisioning contracts.');