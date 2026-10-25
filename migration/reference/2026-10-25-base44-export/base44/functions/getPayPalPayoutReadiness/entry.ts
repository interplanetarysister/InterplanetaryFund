import { secrets } from 'base44:runtime';

let cache = { until: 0, result: null };

export default async function() {
  if (cache.result && cache.until > Date.now()) return Response.json(cache.result);
  try {
    const mode = secrets.get('PAYPAL_MODE');
    const id = String(secrets.get('PAYPAL_CLIENT_ID') || '').trim();
    const secret = String(secrets.get('PAYPAL_CLIENT_SECRET') || '').trim();
    if (mode !== 'live' || !id || !secret) {
      const result = { ok: true, live: false, oauth_authorized: false, payout_scope: false, payout_read_access: false };
      cache = { until: Date.now() + 20000, result };
      return Response.json(result);
    }

    const tokenRes = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`${id}:${secret}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const tokenBody = await tokenRes.json().catch(() => ({}));
    const token = String(tokenBody?.access_token || '');
    const scopeText = String(tokenBody?.scope || '').toLowerCase();
    const payoutScope = /payments\/payouts|payout/.test(scopeText);
    if (!tokenRes.ok || !token) {
      const result = { ok: true, live: true, oauth_authorized: false, payout_scope: payoutScope, payout_read_access: false };
      cache = { until: Date.now() + 20000, result };
      return Response.json(result);
    }

    // Read-only permission probe. This deliberately requests a nonexistent
    // batch id; 404/400 proves the live merchant token reached the Payouts API
    // permission boundary without creating, changing, or sending money.
    const probeRes = await fetch('https://api-m.paypal.com/v1/payments/payouts/IFUND_READINESS_PROBE_DO_NOT_CREATE', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payoutReadAccess = payoutScope && ![401, 403].includes(probeRes.status) && probeRes.status < 500;
    const result = {
      ok: true,
      live: true,
      oauth_authorized: true,
      payout_scope: payoutScope,
      payout_read_access: payoutReadAccess,
    };
    cache = { until: Date.now() + 60000, result };
    return Response.json(result);
  } catch (error) {
    console.error('getPayPalPayoutReadiness failed:', error?.name || 'UnknownError');
    const result = { ok: false, live: false, oauth_authorized: false, payout_scope: false, payout_read_access: false };
    cache = { until: Date.now() + 10000, result };
    return Response.json(result, { status: 503 });
  }
}
