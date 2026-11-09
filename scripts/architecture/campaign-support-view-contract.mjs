/**
 * Credit-free campaign-page support view model.
 * Pure adapter: no checkout creation, API calls, or financial writes.
 * UI owners can consume this without replacing original Base44 integrations.
 */
import { getPlatformSupportLink } from './platform-support-link-contract.mjs';

export function getCampaignSupportView({
  campaignPaymentsPaused = true,
  campaignCheckoutVerifiedReady = false,
  platformPayPalUrl,
  platformPayPalVerified = false,
} = {}) {
  if (!campaignPaymentsPaused) {
    return Object.freeze({
      campaignCheckoutEnabled: campaignCheckoutVerifiedReady === true,
      campaignPausedNotice: null,
      platformSupport: null,
    });
  }
  const platformSupport = getPlatformSupportLink({
    configuredUrl: platformPayPalUrl,
    verified: platformPayPalVerified,
    campaignPaymentsPaused,
  });
  return Object.freeze({
    campaignCheckoutEnabled: false,
    campaignPausedNotice: 'Donations to this campaign are currently paused.',
    platformSupport: platformSupport ? Object.freeze({
      ...platformSupport,
      disclosure: 'This contribution supports Interplanetary Fund moderation, maintenance and development. It does not go to this campaign or its beneficiary.',
      rel: 'noopener noreferrer',
      target: '_blank',
    }) : null,
  });
}
