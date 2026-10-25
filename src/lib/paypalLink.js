// Interplanetary Fund platform-support PayPal link.
// Ported from interplanetary-fund2 src/lib/paypalLink.js with Base44 removed.
//
// This hosted PayPal payment link pays the Interplanetary Fund business
// PayPal account. It supports IFund itself and never credits a campaign.
// Campaign donations must go through tracked IFund checkout once the
// payments phase is approved (see docs/migration/PAYMENTS_PLATFORM_SUPPORT.md).

export const IFUND_SITE_ORIGIN = "https://interplanetaryfund.com";

// Official IFund platform-support payment link supplied by the account owner.
// The destination and available payment options stay under PayPal's control.
export const IFUND_PLATFORM_SUPPORT_PAYMENT_LINK =
  "https://www.paypal.com/ncp/payment/VMW5XU3Y46K5J";

export function generatePayPalLink() {
  // Do not append recipient, charity or amount parameters: the hosted link
  // ignores them and they could mislead donors.
  return IFUND_PLATFORM_SUPPORT_PAYMENT_LINK;
}

export function campaignDonateUrl(campaignId) {
  return campaignId
    ? `${IFUND_SITE_ORIGIN}/campaign/${encodeURIComponent(campaignId)}?donate=true`
    : `${IFUND_SITE_ORIGIN}/discover`;
}

// Donation block appended to cross-posted content so a working link travels
// with the post even if it is copied and pasted.
export function generateDonationBlock(campaignId, platformOnly = false) {
  if (platformOnly) {
    return `\n\nSupport Interplanetary Fund: ${generatePayPalLink()}\nThis payment supports Interplanetary Fund development and operations, not the individual campaign shown.`;
  }
  return `\n\nSupport this campaign: ${campaignDonateUrl(campaignId)}\nEvery donation makes a difference. Thank you.`;
}

// Short version for character-limited platforms (X, etc.).
export function generateShortDonationBlock(campaignId, platformOnly = false) {
  if (platformOnly) {
    return `\nSupport Interplanetary Fund (not this campaign): ${generatePayPalLink()}`;
  }
  return `\nDonate: ${campaignDonateUrl(campaignId)}`;
}
