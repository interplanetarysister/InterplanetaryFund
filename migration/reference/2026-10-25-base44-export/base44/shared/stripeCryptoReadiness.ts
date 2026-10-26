import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';

// Probe provider reality, not a checkbox, wallet login or an API-key string.
// Crypto checkout is only usable when the *existing* IFund Stripe merchant has
// Stripe's stablecoin method activated and its money-mirror webhook connected.
let cached: { until: number; result: any } = { until: 0, result: null };
const EVENTS = ['checkout.session.completed', 'checkout.session.async_payment_succeeded',
  'charge.refunded', 'charge.dispute.created'];

export async function stripeCryptoGatewayReadiness(force = false) {
  if (!force && cached.result && cached.until > Date.now()) return cached.result;
  const result: any = {
    provider: 'stripe',
    payout_currency: 'USD',
    approved: false,
    webhook_ready: false,
    account_ready: false,
    ready: false,
    reason: 'Stripe stablecoin merchant approval and webhook verification are required.',
  };
  const key = String(secrets.get('STRIPE_SECRET_KEY') || '');
  const webhookSecret = String(secrets.get('STRIPE_WEBHOOK_SECRET') || '');
  if (!key.startsWith('sk_live_') || !webhookSecret) {
    result.reason = 'Live Stripe credentials or webhook verification are not configured.';
    cached = { until: Date.now() + 15000, result };
    return result;
  }
  try {
    const stripe = new Stripe(key);
    const [account, configurations, hooks] = await Promise.all([
      stripe.accounts.retrieve(),
      stripe.paymentMethodConfigurations.list({ limit: 100 }),
      stripe.webhookEndpoints.list({ limit: 100 }),
    ]);
    result.account_ready = account?.charges_enabled === true && account?.details_submitted === true;
    const cfgs = configurations?.data || [];
    result.approved = cfgs.some((cfg: any) =>
      cfg.active === true && cfg.livemode === true &&
      cfg.crypto?.available === true &&
      cfg.crypto?.display_preference?.value === 'on');
    result.webhook_ready = (hooks.data || []).some((hook: any) => {
      const url = String(hook.url || '').toLowerCase();
      const enabled = new Set(hook.enabled_events || []);
      return hook.status === 'enabled' &&
        url.includes('stripewebhook') &&
        (url.includes('interplanetaryfund') || url.includes('6a67a778342a8fe05ee79cba')) &&
        (enabled.has('*') || EVENTS.every(event => enabled.has(event)));
    });
    result.ready = result.approved && result.account_ready && result.webhook_ready;
    result.reason = !result.account_ready
      ? 'Stripe business verification must finish before accepting crypto.'
      : !result.approved
        ? 'Stripe has not confirmed that Stablecoin and Crypto payments are enabled for this merchant.'
        : !result.webhook_ready
          ? 'The Stripe webhook must be registered and tested for confirmed donations.'
          : 'Stripe stablecoin method and live webhook are enabled. A live end-to-end transaction is still required before production acceptance.';
  } catch (error) {
    console.error('stripeCryptoGatewayReadiness:', error?.name || 'UnknownError');
    result.reason = 'Stripe provider permissions or crypto readiness could not be verified.';
  }
  cached = { until: Date.now() + (result.ready ? 45000 : 20000), result };
  return result;
}
