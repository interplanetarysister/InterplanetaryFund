import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const app=read('src/App.jsx');
const layout=read('src/components/Layout.jsx');
const create=read('src/pages/CreateCampaign.jsx');
const save=read('base44/functions/saveCampaign/entry.ts');
const donate=read('src/components/campaigns/DonateDialog.jsx');
const paypal=read('base44/functions/createPayPalOrder/entry.ts');
const paymentCaps=read('base44/functions/getPaymentCapabilities/entry.ts');
const stripe=read('base44/functions/createDonationCheckout/entry.ts');
const subscriptions=read('src/pages/Subscriptions.jsx');
const subCheckout=read('base44/functions/createSubscriptionCheckout/entry.ts');
const community=read('base44/functions/createCommunity/entry.ts');
const institution=read('base44/functions/createInstitution/entry.ts');
const donors=read('base44/functions/getOwnerDonorDirectory/entry.ts');
const ledger=read('base44/functions/getOwnerFinancialLedger/entry.ts');
const communications=read('base44/functions/sendCommunication/entry.ts');
const contact=read('base44/functions/sendPublicContactMessage/entry.ts');

for (const route of ['/discover','/campaign/:id','/community','/help']) assert.match(app,new RegExp(`path="${route.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&')}"`));
for (const route of ['/dashboard','/create','/connections','/inbox','/notifications','/donors','/ledger','/subscriptions','/withdrawals','/agents']) assert.match(app,new RegExp(`path="${route}"`));
assert.match(app, /<Route element=\{<AdminRoute \/>\}><Route path="\/ops"/);
assert.match(app, /<Route path="\/platform" element=\{<Platform \/>\}/);
assert.match(layout, /const adminOnly = \["\/analytics", "\/connect", "\/ops", "\/platform"\]/);
assert.match(layout, /const publicNavItems = \[/);
assert.match(layout, /to: "\/", label: "Home"/);
assert.match(layout, /to: "\/help", label: "Help"/);
assert.match(layout, /user \? "\/dashboard" : "\/"/);

assert.match(create, /Save draft/);
assert.match(create, /status: "draft"/);
assert.match(save, /Blank title and zero goal are valid PRIVATE drafts/);
assert.match(save, /status !== 'draft'/);

assert.match(donate, /getPaymentCapabilities/);
assert.match(paypal, /areFeaturesEnabled\(base44, \['payment_checkout_enabled'/);
assert.match(paypal, /campaign\.status !== 'active'/);
assert.match(paymentCaps, /STRIPE_WEBHOOK_SECRET/);
assert.match(paymentCaps, /webhook_configured/);
assert.match(stripe, /!stripeWebhookSecret/);
assert.match(subCheckout, /!stripeWebhookSecret/);
assert.equal((subscriptions.match(/disabled=/g)||[]).length > 0,true);
assert.doesNotMatch(subscriptions,/disabled=\{!checkoutEnabled \|\| subscribing !== null\}\s+disabled=/);

assert.match(community,/isFeatureEnabled\(base44, 'community_creation'\)/);
assert.match(institution,/isFeatureEnabled\(base44, 'institution_programs'\)/);
assert.match(donors,/created_by_id: user\.id/);
assert.match(ledger,/campaign_owner_user_id: user\.id/);
assert.match(communications,/payment_verified === true/);
assert.match(communications,/pool = pool\.filter\(\(d\) => d\.is_recurring/);
assert.doesNotMatch(communications,/Email integration is not available: \$\{/);
assert.match(contact,/checkRateLimit/);
assert.match(contact,/publicContact:/);
assert.match(contact,/name\.length > 160/);
assert.match(contact,/message\.length > 10000/);

console.log('live user readiness source contract: PASS');