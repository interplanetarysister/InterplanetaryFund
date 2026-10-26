import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');

const connections = read('src/pages/Connections.jsx');
const analytics = read('src/pages/Analytics.jsx');
const ops = read('src/pages/OpsCenter.jsx');
const globe = read('src/components/globe/CampaignGlobe.jsx');
const integration = read('src/pages/IntegrationsAdmin.jsx');
const managed = read('base44/functions/requestManagedConnectionAction/entry.ts');
const browser = read('base44/functions/runBrowserConnection/entry.ts');
const providers = read('base44/shared/providerCapabilities.ts');
const capture = read('base44/functions/capturePayPalOrder/entry.ts');
const recovery = read('base44/functions/reconcileDirectPayPalCampaignDonation/entry.ts');
const recoveryList = read('base44/functions/listUntrackedPayPalReceipts/entry.ts');
const financial = read('base44/shared/base44Financial.ts');
const allocation = read('base44/shared/paypalAllocation.js');
const googlePay = read('src/components/payments/GooglePayButton.jsx');
const paypalButton = read('src/components/payments/PayPalCheckoutButton.jsx');
const donateDialog = read('src/components/campaigns/DonateDialog.jsx');
const fees = read('base44/shared/fees.js');
const paymentTests = read('package.json');

assert.match(connections, /requestGeneration = useRef/);
assert.match(connections, /mountedRef = useRef/);
assert.match(connections, /Malformed connections response/);
assert.match(connections, /Malformed sync response/);
assert.match(connections, /aria-live="polite"/);
assert.doesNotMatch(connections, /setSyncResult\(data\)/);

assert.match(analytics, /requestGeneration = useRef/);
assert.match(analytics, /Malformed donation response/);
assert.match(analytics, /SAFE_ANALYTICS_ERROR/);

assert.match(ops, /requestGeneration = useRef/);
assert.match(ops, /providerState/);
assert.match(ops, /No synthetic agent data is shown/);
assert.doesNotMatch(ops, /IN_APP_AGENTS/);
assert.match(ops, /const ok = await load\(\)/);

assert.match(globe, /touchAction = "pan-y"/);
assert.match(globe, /setPointerCapture/);
assert.match(globe, /pointercancel/);
assert.match(globe, /MOBILE_BREAKPOINT/);
assert.match(globe, /Number\.isFinite\(c\?\.location_lat\)/);

assert.match(integration, /REQUEST_TIMEOUT_MS/);
assert.match(managed, /hasManagedConnections/);
assert.match(browser, /browser_execution_deferred/);
assert.doesNotMatch(providers, /balance_read:true/);

// PR #492 was migrated as payment invariants only. These checks intentionally
// coexist with the newer managed-connection and external-settlement contracts.
assert.match(capture, /cap\.status !== 'COMPLETED'/);
assert.match(capture, /cap\.capture_status !== 'COMPLETED'/);
assert.match(capture, /!cap\.capture_id/);
assert.ok(capture.indexOf('existingOperations.length') < capture.indexOf('resolvePayPalCaptureAllocation({'));
assert.match(capture, /HoldingLedgerEntry\.upsert/);
assert.match(capture, /persistedHoldings\.length !== 1/);
assert.match(financial, /allocation_fingerprint/);
assert.match(financial, /payment_channel/);
assert.match(financial, /key: \['operation_key', 'allocation_fingerprint'\]/);
assert.match(financial, /Legacy donation operation is missing immutable payment-channel evidence/);
assert.match(recoveryList, /ops\.length === 1/);
assert.match(recoveryList, /donations\.length === 1/);
assert.match(recoveryList, /holdings\.length === 1/);
assert.match(recovery, /allocationIsComplete/);
assert.match(recovery, /persistedMirrorChannels\.size !== 1/);
assert.match(recovery, /existingRows\.length && paymentMethods\.size === 0/);
assert.match(allocation, /provider_breakdown_mismatch/);
assert.doesNotMatch(allocation, /validateDonationAmount\(amount\)/);
assert.match(googlePay, /!order\?\.id \|\| typeof order\.id !== "string"/);
assert.match(googlePay, /campaign\.id, value\.toFixed\(2\), "googlepay", selectedContribution/);
assert.match(paypalButton, /campaign\.id, value\.toFixed\(2\), "paypal", selectedContribution/);
assert.match(donateDialog, /Give with PayPal/);
assert.match(donateDialog, /<PayPalCheckoutButton campaign=\{campaign\}/);
assert.match(donateDialog, /Give with Google Pay/);
assert.match(donateDialog, /<GooglePayButton campaign=\{campaign\}/);
assert.match(fees, /PLATFORM_FEE_RATE = 0\.03/);
assert.match(paymentTests, /test:paypal-financial-recovery/);
assert.match(paymentTests, /test-paypal-wallet-readiness\.mjs/);
const legacyVault = read('base44/entities/AdminCredentialVault.jsonc');
assert.doesNotMatch(legacyVault, /"secret_value"|"password"|"username"|"sign_in_secret"/i);
assert.match(legacyVault, /provider-managed secret/i);

console.log('post-repair migration completion contract: PASS');
