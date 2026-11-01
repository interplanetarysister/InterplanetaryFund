// Deterministic source + helper behavior regression tests; NOT real-provider E2E.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FEATURE_SCOPES, CODE_CONNECTED_FEATURES, NEVER_SWITCH_OFF,
  isFeatureEnabled, areFeaturesEnabled,
} from '../base44/shared/featureFlagGate.ts';

const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');
const mock = rows => ({
  asServiceRole: { entities: { FeatureFlag: { filter: async ({key}) => rows.filter(f=>f.key===key) } } },
});
const yes = (key) => ({key, enabled:true, scope:FEATURE_SCOPES[key]});
const no = (key) => ({key, enabled:false, scope:FEATURE_SCOPES[key]});

assert.equal(Object.keys(FEATURE_SCOPES).length, 21,
  'Keep the Apple Pay and crypto donations flags in the reviewed inventory');
assert.equal(new Set(CODE_CONNECTED_FEATURES).size, CODE_CONNECTED_FEATURES.length);
assert.ok(CODE_CONNECTED_FEATURES.every(k => FEATURE_SCOPES[k]));
assert.ok(CODE_CONNECTED_FEATURES.includes('crypto_donations'),
  'Crypto donations must remain an explicitly gated platform feature');
assert.ok(!CODE_CONNECTED_FEATURES.includes('admin_agent_execution'), 'Unverified admin agents must not be wired as a public switch');
assert.ok(NEVER_SWITCH_OFF.includes('paypal_donation_reconciliation'), 'Financial reconciliation is always on');
assert.ok(NEVER_SWITCH_OFF.includes('new_campaign_publishing'), 'Site publishing is always on');

for(const key of CODE_CONNECTED_FEATURES) {
  assert.equal(await isFeatureEnabled(mock([yes(key)]), key), true, key);
  assert.equal(await isFeatureEnabled(mock([no(key)]), key), false, key);
  assert.equal(await isFeatureEnabled(mock([]), key), false, key);
  assert.equal(await isFeatureEnabled(mock([{...yes(key),scope:'incorrect'}]), key), false, key);
  assert.equal(await isFeatureEnabled(mock([yes(key),yes(key)]), key), false, key);
}
assert.equal(await isFeatureEnabled(mock([yes('community_creation')]), 'unknown_key'), false);
assert.equal(await isFeatureEnabled({asServiceRole:{entities:{FeatureFlag:{filter:async()=>{throw Error('offline')}}}}}, 'community_creation'), false);
assert.equal(await areFeaturesEnabled(mock([yes('paypal_checkout'),yes('payment_checkout_enabled')]), ['paypal_checkout','payment_checkout_enabled']), true);
assert.equal(await areFeaturesEnabled(mock([yes('paypal_checkout')]), ['paypal_checkout','payment_checkout_enabled']), false);

const entry = (name) => read('base44/functions/'+name+'/entry.ts');
const checks = [
  ['community_creation','createCommunity'],
  ['institution_programs','createInstitution'],
  ['institution_programs','publishInstitutionOpportunity'],
  ['institution_programs','applyInstitutionOpportunity'],
  ['external_campaign_import','importExternalCampaign'],
  ['ai_outreach_agent','runOutreachAgent'],
  ['social_autopilot','runSocialAutopilot'],
  ['external_feed_mirroring','mirrorExternalPosts'],
  ['ai_campaign_assistant','generateDistributionContent'],
  ['ai_campaign_assistant','generateIntelligence'],
  ['cross_platform_publishing','publishPost'],
  ['cross_platform_publishing','broadcastPosts'],
  ['managed_connections','requestManagedConnectionAction'],
  ['external_fund_collection','prepareCollectAndWithdraw'],
  ['subscription_checkout','createPayPalSubscriptionCheckout'],
  ['outbound_payout_execution','requestWithdrawal'],
];
for(const [key,fn] of checks) {
  assert.match(entry(fn),new RegExp("isFeatureEnabled\\(base44, '"+key+"'\\)"), fn+' '+key);
}
const paypal = entry('createPayPalOrder');
assert.match(paypal,/channel === 'googlepay' \? 'google_pay_checkout' : channel === 'applepay' \? 'apple_pay_checkout' : 'paypal_checkout'/);
assert.match(paypal,/payment_checkout_enabled/);
const stripe = entry('createDonationCheckout');
assert.match(stripe,/status: 410/, 'Stripe donations must be retired');
assert.match(entry('createSubscriptionCheckout'),/status: 410/);
assert.match(entry('createPremiumDayPassCheckout'),/status: 410/);
const manual = entry('recordDonation');
assert.match(manual,/payment_checkout_enabled/);
assert.match(read('base44/shared/prelaunchPayments.ts'),/isPublicCampaignFundraisingEnabled/);
assert.doesNotMatch(entry('capturePayPalOrder'),/isFeatureEnabled|campaignPaymentAccess\(base44\)/,
  'Previously started PayPal payments must always be capturable and reconcilable');
assert.match(entry('capturePayPalOrder'),/recordCanonicalDonation/);
const syncConnections = entry('syncConnections');
assert.match(syncConnections, /if \(publishingEnabled && access\.ok\) \{/,
  'Outbound publishing must have an explicit feature and platform-access gate');
assert.ok(syncConnections.indexOf('// --- Connection health:') > syncConnections.indexOf('if (publishingEnabled && access.ok)'),
  'Provider health checking must remain outside the outbound publishing gate');
assert.doesNotMatch(entry('saveCampaign'),/isFeatureEnabled|areFeaturesEnabled/,
  'Campaign creation and publishing cannot be gated');
for(const fn of ['stripeWebhook','kofiWebhook','discoverPayPalHoldingSettlements','reconcileDirectPayPalCampaignDonation','getOwnerFinancialLedger','getCampaignWithdrawalBalance']) {
  assert.doesNotMatch(entry(fn),/isFeatureEnabled|areFeaturesEnabled/,fn+' must remain available');
}
const payout = entry('requestWithdrawal');
assert.match(payout,/action === 'request' \|\| action === 'approve'/);
assert.ok(payout.indexOf("action === 'reconcile_paid'") < payout.indexOf("const payout = await sendPayout"),
  'Previously submitted payouts must remain reconcilable');
const manage = entry('manageFeatureFlag');
assert.match(manage,/CODE_CONNECTED_FEATURES\.includes\(flag\.key\)/);
assert.match(manage,/FEATURE_SCOPES\[key\]/);
const panel = read('src/components/platform/FeatureFlagsPanel.jsx');
for (const key of CODE_CONNECTED_FEATURES) assert.ok(panel.includes('"'+key+'"'),key+' admin catalog missing');
assert.match(panel,/ALWAYS_AVAILABLE/);
assert.match(panel,/RETIRED_FLAGS/);
assert.match(read('src/lib/useFeatureEnabled.js'),/getFeatureAvailability/);
assert.match(entry('getFeatureAvailability'),/Cache-Control/);

console.log('PASS: feature flags fail closed, including crypto donations; admin agent execution remains unverified, and core accounting stays available.');
