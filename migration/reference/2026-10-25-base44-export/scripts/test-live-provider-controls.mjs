import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const read = file => fs.readFileSync(new URL('../'+file, import.meta.url), 'utf8');
const gate = read('base44/shared/featureFlagGate.ts');
const flags = {
  paypal_checkout: 'beta', stripe_checkout: 'beta', outbound_payout_execution: 'global',
  crypto_donations: 'global', community_creation: 'global', cross_platform_publishing: 'beta',
};
const connected = ['paypal_checkout','stripe_checkout','outbound_payout_execution','community_creation','cross_platform_publishing','crypto_donations'];
const source = read('base44/shared/liveProviderReadiness.ts');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const exports = {};
const fakeRequire = name => {
  if (name === 'npm:stripe@17.7.0') return { default: class Stripe {} };
  if (name === 'base44:runtime') return { secrets: { get: () => undefined } };
  if (name === './featureFlagGate.ts') return { FEATURE_SCOPES: flags, CODE_CONNECTED_FEATURES: connected };
  if (name === './paypal.ts') return { isLivePayPalRestReady: async () => false, isLivePayPalPayoutReady: async () => false };
  if (name === './paypalSubscriptions.ts') return { IFUND_PAYPAL_ACCOUNT_REF: 'test', verifiedPayPalPlan: async () => null, paypalBillingRequest: async () => ({}) };
  if (name === './subscriptionCatalog.js') return { subscriptionPrices: () => [] };
  if (name === './stripeCryptoReadiness.ts') return { stripeCryptoGatewayReadiness: async () => ({ready:false,reason:'not configured'}) };
  throw new Error('Unexpected import: '+name);
};
new Function('require','exports',js)(fakeRequire,exports);
const provider = await exports.probeLiveProviders();
for (const name of ['paypal_checkout','stripe_checkout','paypal_payouts','nowpayments','reown']) {
  assert.equal(provider[name].ready, false, name+' must fail closed without actual provider credentials');
}
assert.equal(exports.assessFeatureReadiness('outbound_payout_execution', provider).ready, false);
assert.equal(exports.assessFeatureReadiness('crypto_donations', provider).ready, false);
assert.equal(exports.assessFeatureReadiness('community_creation', provider).ready, true);
assert.equal(exports.assessFeatureReadiness('cross_platform_publishing', provider,[{platform:'facebook_pages',status:'ACTIVE',last_successful_verification:'2020-01-01T00:00:00Z'}]).ready,false);
assert.equal(exports.liveFeatureSnapshot('paypal_checkout', [], provider).state, 'switch_missing');
assert.equal(exports.liveFeatureSnapshot('crypto_donations', [], provider).state, 'switch_missing');
const flagHandler = read('base44/functions/manageFeatureFlag/entry.ts');
assert.match(flagHandler, /if \(enabled\) \{[\s\S]*?assessFeatureReadiness\(flag\.key[\s\S]*?if \(!readiness\.ready\)/);
assert.match(read('base44/functions/getLiveProviderStatus/entry.ts'), /guard\.user\.role !== 'admin'/);
assert.match(read('src/pages/Platform.jsx'), /LiveProvidersPanel/);
assert.match(read('src/components/platform/LiveProvidersPanel.jsx'), /getLiveProviderStatus/);
assert.match(gate, /crypto_donations: 'global'/);
console.log('PASS: missing providers fail closed; stale verification rejected; admin roles protected; new switches off; unimplemented crypto transfer remains locked.');
