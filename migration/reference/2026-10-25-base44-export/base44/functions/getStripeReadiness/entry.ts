import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';

let cache = { until: 0, result: null };
const REQUIRED_EVENTS = new Set([
  'checkout.session.completed',
  'invoice.paid',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

export default async function() {
  if (cache.result && cache.until > Date.now()) return Response.json(cache.result);
  try {
    const key = String(secrets.get('STRIPE_SECRET_KEY') || '');
    const signingSecret = String(secrets.get('STRIPE_WEBHOOK_SECRET') || '');
    if (!key.startsWith('sk_live_') || !signingSecret) {
      const result = { ok: true, live_key: key.startsWith('sk_live_'), webhook_secret_present: !!signingSecret, account_reachable: false, webhook_endpoint_verified: false, required_events_covered: false };
      cache = { until: Date.now() + 20000, result };
      return Response.json(result);
    }

    const stripe = new Stripe(key);
    const [account, endpoints] = await Promise.all([
      stripe.accounts.retrieve(),
      stripe.webhookEndpoints.list({ limit: 100 }),
    ]);
    const rows = endpoints.data || [];
    const expected = rows.filter((endpoint) => {
      const url = String(endpoint.url || '').toLowerCase();
      return endpoint.status === 'enabled' && (
        (url.includes('6a67a778342a8fe05ee79cba') && url.includes('stripewebhook')) ||
        (url.includes('interplanetaryfund') && url.includes('stripewebhook'))
      );
    });
    const coversRequired = (endpoint) => {
      const events = new Set(endpoint.enabled_events || []);
      return events.has('*') || [...REQUIRED_EVENTS].every((event) => events.has(event));
    };
    const requiredEventsCovered = expected.some(coversRequired);
    const requiredEventEndpoints = rows.filter(coversRequired);

    const result = {
      ok: true,
      live_key: true,
      webhook_secret_present: true,
      account_reachable: !!account?.id,
      webhook_endpoint_verified: expected.length > 0,
      required_events_covered: requiredEventsCovered,
      webhook_endpoint_count: rows.length,
      enabled_endpoint_count: rows.filter((endpoint) => endpoint.status === 'enabled').length,
      required_event_endpoint_count: requiredEventEndpoints.length,
      matching_disabled_endpoint_count: rows.filter((endpoint) => {
        const url = String(endpoint.url || '').toLowerCase();
        return endpoint.status !== 'enabled' && ((url.includes('6a67a778342a8fe05ee79cba') && url.includes('stripewebhook')) || (url.includes('interplanetaryfund') && url.includes('stripewebhook')));
      }).length,
    };
    cache = { until: Date.now() + 60000, result };
    return Response.json(result);
  } catch (error) {
    console.error('getStripeReadiness failed:', error?.name || 'UnknownError');
    const result = { ok: false, live_key: false, webhook_secret_present: false, account_reachable: false, webhook_endpoint_verified: false, required_events_covered: false };
    cache = { until: Date.now() + 10000, result };
    return Response.json(result, { status: 503 });
  }
}
