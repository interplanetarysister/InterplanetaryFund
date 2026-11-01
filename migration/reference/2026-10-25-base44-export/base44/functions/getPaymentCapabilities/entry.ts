import { secrets } from 'base44:runtime';
import { IFUND_PAYPAL_ACCOUNT_REF, IFUND_PAYPAL_ACCOUNT_TYPE, isLivePayPalRestReady, isLivePayPalPayoutReady } from '../../shared/paypal.ts';

// Public-safe payment capability snapshot. UI must use this instead of
// inferring provider availability from rendered components or repository code.
export default async function (_req) {
  const paypalClientId = secrets.get('PAYPAL_CLIENT_ID');
  const paypalClientSecret = secrets.get('PAYPAL_CLIENT_SECRET');
  const paypalMode = secrets.get('PAYPAL_MODE') === 'live' ? 'live' : 'sandbox';
  const paypalApiLive = Boolean(paypalClientId && paypalClientSecret && paypalMode === 'live' && await isLivePayPalRestReady());
  const paypalPayoutLive = paypalApiLive && await isLivePayPalPayoutReady();

  return Response.json({
    paypal: {
      // The canonical paypal.com donation-link path is independently available
      // and does not require REST API credentials. Do not conflate it with SDK/API checkout.
      donation_link_available: true,
      api_configured: Boolean(paypalClientId && paypalClientSecret),
      api_live: paypalApiLive,
      payout_api_live: paypalPayoutLive,
      mode: paypalMode,
      account_ref: IFUND_PAYPAL_ACCOUNT_REF,
      account_type: IFUND_PAYPAL_ACCOUNT_TYPE,
    },
  });
}
