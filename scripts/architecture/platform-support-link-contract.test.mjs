import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlatformSupportLink } from './platform-support-link-contract.mjs';
const valid = 'https://www.paypal.com/donate/?hosted_button_id=EXAMPLE';
test('verified platform destination remains separate from campaign', () => {
  const link = getPlatformSupportLink({ configuredUrl: valid, verified: true });
  assert.equal(link?.allocation, 'platform-support');
  assert.equal(link?.campaignId, null);
  assert.equal(link?.campaignDonation, false);
});
test('unverified and absent destination fail closed', () => {
  assert.equal(getPlatformSupportLink({ configuredUrl: valid }), null);
  assert.equal(getPlatformSupportLink({ verified: true }), null);
});
test('non PayPal and insecure URLs fail closed', () => {
  for (const url of ['http://paypal.com/donate/123', 'https://paypal.com.evil.test/donate/123', 'javascript:alert(1)', 'https://example.com/donate', 'https://user:password@paypal.com/donate/123']) {
    assert.equal(getPlatformSupportLink({ configuredUrl: url, verified: true }), null);
  }
});
test('do not show fallback support action when campaign checkout is active', () => {
  assert.equal(getPlatformSupportLink({ configuredUrl: valid, verified: true, campaignPaymentsPaused: false }), null);
});
