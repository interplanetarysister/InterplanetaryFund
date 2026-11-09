import test from 'node:test';
import assert from 'node:assert/strict';
import { getCampaignSupportView } from './campaign-support-view-contract.mjs';

const url = 'https://www.paypal.com/donate/?hosted_button_id=OWNER_VERIFIED';
test('paused campaign presents verified platform support, never campaign checkout', () => {
  const view = getCampaignSupportView({ campaignPaymentsPaused: true, platformPayPalUrl: url, platformPayPalVerified: true });
  assert.equal(view.campaignCheckoutEnabled, false);
  assert.equal(view.platformSupport.href, url);
  assert.equal(view.platformSupport.campaignDonation, false);
  assert.equal(view.platformSupport.campaignId, null);
  assert.equal(view.platformSupport.allocation, 'platform-support');
  assert.match(view.platformSupport.disclosure, /does not go to this campaign/i);
});
test('unverified platform URL fails closed without restoring campaign checkout', () => {
  const view = getCampaignSupportView({ platformPayPalUrl: url });
  assert.equal(view.campaignCheckoutEnabled, false);
  assert.equal(view.platformSupport, null);
  assert.match(view.campaignPausedNotice, /paused/);
});
test('active campaign checkout does not display paused-mode fallback', () => {
  const view = getCampaignSupportView({ campaignPaymentsPaused: false, platformPayPalUrl: url, platformPayPalVerified: true });
  assert.equal(view.platformSupport, null);
  assert.equal(view.campaignPausedNotice, null);
});
test('view model is frozen and has no financial mutations', () => {
  const view = getCampaignSupportView({ platformPayPalUrl: url, platformPayPalVerified: true });
  assert.equal(Object.isFrozen(view), true);
  assert.equal(Object.isFrozen(view.platformSupport), true);
  assert.equal('createOrder' in view, false);
  assert.equal('recordDonation' in view, false);
});
