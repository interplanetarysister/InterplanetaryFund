import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const paypal = read('base44/shared/paypal.ts');
const config = read('base44/functions/getPayPalConfig/entry.ts');
const caps = read('base44/functions/getPaymentCapabilities/entry.ts');
const link = read('src/lib/paypalLink.js');
const custody = read('docs/CUSTODY_HOLDING_LEDGER_CONTRACT.md');

assert.match(paypal, /IFUND_PAYPAL_ACCOUNT_REF = "interplanetary_business_paypal"/);
assert.match(paypal, /IFUND_PAYPAL_ACCOUNT_TYPE = "business"/);
assert.match(paypal, /IFUND_PAYPAL_BUSINESS_EMAIL = "cuddlemeplatonically@gmail\.com"/);
assert.match(paypal, /payee:\s*\{\s*email_address:\s*IFUND_PAYPAL_BUSINESS_EMAIL\s*\}/);
assert.match(paypal, /https:\/\/api-m\.paypal\.com/);
assert.match(paypal, /https:\/\/api-m\.sandbox\.paypal\.com/);

assert.match(config, /account_ref: IFUND_PAYPAL_ACCOUNT_REF/);
assert.match(config, /account_type: IFUND_PAYPAL_ACCOUNT_TYPE/);
assert.match(config, /business_email: IFUND_PAYPAL_BUSINESS_EMAIL/);
assert.match(caps, /account_ref: IFUND_PAYPAL_ACCOUNT_REF/);
assert.match(caps, /account_type: IFUND_PAYPAL_ACCOUNT_TYPE/);

assert.match(link, /IFUND_PAYPAL_BUSINESS_EMAIL = "cuddlemeplatonically@gmail\.com"/);
assert.match(link, /IFUND_PLATFORM_SUPPORT_PAYMENT_LINK/);
assert.match(link, /paypal\.com\/ncp\/payment\/VMW5XU3Y46K5J/);
assert.doesNotMatch(link, /cmd: "_donations"/);
assert.doesNotMatch(link, /https:\/\/www\.paypal\.com\/donate\//);

for (const p of [
  'base44/functions/capturePayPalOrder/entry.ts',
  'base44/functions/discoverPayPalHoldingSettlements/entry.ts',
  'base44/functions/reconcileDirectPayPalCampaignDonation/entry.ts',
  'base44/functions/matchExternalPayPalSettlement/entry.ts',
  'base44/functions/reconcileExternalPayPalSettlement/entry.ts',
  'base44/functions/requestWithdrawal/entry.ts',
]) {
  const src = read(p);
  assert.match(src, /IFUND_PAYPAL_ACCOUNT_REF/);
  assert.doesNotMatch(src, /source_account_ref:\s*['"]interplanetary_business_paypal['"]/);
}
assert.match(custody, /Live PayPal Business REST credentials used for IFund/);
assert.match(custody, /email in configuration is not itself proof/);
assert.match(custody, /finance aggregators are diagnostic only/);

console.log('Canonical IFund PayPal Business account contract verified.');
