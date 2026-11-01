import { secrets } from 'base44:runtime';
import { IFUND_PAYPAL_ACCOUNT_REF, IFUND_PAYPAL_ACCOUNT_TYPE, IFUND_PAYPAL_BUSINESS_EMAIL, isLivePayPalRestReady } from '../../shared/paypal.ts';

// Public-safe PayPal capability snapshot. PayPal has two independent paths in
// this app: the canonical paypal.com donation link and REST/SDK checkout.
// Never label the whole provider offline merely because REST credentials are
// absent, and never label REST checkout live merely because a donate link works.
export default async function (_req) {
  const clientId = secrets.get('PAYPAL_CLIENT_ID');
  const clientSecret = secrets.get('PAYPAL_CLIENT_SECRET');
  const mode = secrets.get('PAYPAL_MODE') === 'live' ? 'live' : 'sandbox';
  const apiConfigured = Boolean(clientId && clientSecret);
  const apiLive = Boolean(apiConfigured && mode === "live" && await isLivePayPalRestReady());

  return Response.json({
    client_id: apiLive ? clientId : null,
    mode,
    configured: apiConfigured,
    live: apiLive,
    donation_link_available: true,
    api_configured: apiConfigured,
    api_live: apiLive,
    provider: 'paypal',
    account_ref: IFUND_PAYPAL_ACCOUNT_REF,
    account_type: IFUND_PAYPAL_ACCOUNT_TYPE,
    business_email: IFUND_PAYPAL_BUSINESS_EMAIL,
  });
}
