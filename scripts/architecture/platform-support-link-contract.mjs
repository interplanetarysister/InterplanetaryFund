/**
 * Pure platform-support destination contract.
 * Never constructs or guesses a PayPal address and never posts campaign donations.
 * The configured URL must be supplied by a verified platform owner.
 */
export function getPlatformSupportLink({ configuredUrl, verified = false, campaignPaymentsPaused = true } = {}) {
  if (!campaignPaymentsPaused || !verified || typeof configuredUrl !== 'string') return null;
  let url;
  try { url = new URL(configuredUrl); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !['paypal.com', 'www.paypal.com', 'paypal.me', 'www.paypal.me'].includes(url.hostname.toLowerCase())) return null;
  if (!url.pathname || url.pathname === '/' || url.pathname.includes('..')) return null;
  return Object.freeze({
    href: url.href,
    label: 'Support Interplanetary Fund moderation and development',
    recipient: 'Interplanetary Fund',
    allocation: 'platform-support',
    campaignId: null,
    campaignDonation: false,
    external: true,
  });
}
