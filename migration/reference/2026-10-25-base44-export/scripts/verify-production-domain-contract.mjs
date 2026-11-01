import assert from 'node:assert/strict';import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8'),donation=fs.readFileSync('base44/functions/createDonationCheckout/entry.ts','utf8'),subscription=fs.readFileSync('base44/functions/createSubscriptionCheckout/entry.ts','utf8');
assert.match(html,/rel="canonical" href="https:\/\/interplanetaryfund\.com\/"/);
assert.match(html,/property="og:url" content="https:\/\/interplanetaryfund\.com\/"/);
// Stripe checkout is retired: both legacy handlers must stay retired (410)
// rather than silently resurrecting an unreviewed payment path.
assert.match(donation,/Stripe donations are retired/);
assert.match(subscription,/Stripe checkout is retired/);
// The live subscription checkout must only return donors to an approved https origin.
const liveSubscription=fs.readFileSync('base44/functions/createPayPalSubscriptionCheckout/entry.ts','utf8');
const paypalSubscriptionShared=fs.readFileSync('base44/shared/paypalSubscriptions.ts','utf8');
assert.match(liveSubscription,/permittedPayPalCheckoutOrigin\(origin\)/);
assert.match(liveSubscription,/return_url: approvedOrigin \+ '\/subscriptions\?paypal_checkout=return'/);
assert.match(paypalSubscriptionShared,/value\.protocol === 'https:' && value\.username === '' && value\.password === ''/);
assert.match(paypalSubscriptionShared,/'https:\/\/interplanetaryfund\.com'/);
assert.match(paypalSubscriptionShared,/'https:\/\/www\.interplanetaryfund\.com'/);
console.log('Production custom-domain and payment-return origin contract passed.');
