import { secrets } from 'base44:runtime';
import { FEATURE_SCOPES, CODE_CONNECTED_FEATURES } from './featureFlagGate.ts';
import { isLivePayPalRestReady, isLivePayPalPayoutReady } from './paypal.ts';
import { IFUND_PAYPAL_ACCOUNT_REF, paypalBillingRequest, verifiedPayPalPlan } from './paypalSubscriptions.ts';
import { subscriptionPrices } from './subscriptionCatalog.js';

// A connection, secret, or administrative toggle alone never means that real
// donations, payouts, posting, or agent execution are operational.
export const LIVE_FEATURE_NAMES: Record<string, string> = {
  public_campaign_fundraising: 'Campaign donations',
  payment_checkout_enabled: 'Donation checkout',
  paypal_checkout: 'PayPal payments',
  google_pay_checkout: 'Google Pay',
  apple_pay_checkout: 'Apple Pay',
  stripe_checkout: 'Retired payment rail',
  recurring_donations: 'Monthly giving',
  subscription_checkout: 'Subscriptions',
  outbound_payout_execution: 'Campaign withdrawals',
  ai_campaign_assistant: 'AI campaign assistance',
  ai_outreach_agent: 'AI outreach',
  social_autopilot: 'Social posting assistant',
  cross_platform_publishing: 'Cross-platform publishing',
  managed_connections: 'Connected accounts',
  external_campaign_import: 'Campaign imports',
  external_fund_collection: 'External fundraiser collections',
  external_feed_mirroring: 'External activity feed',
  community_creation: 'Community creation',
  institution_programs: 'Institution programs',
  admin_agent_execution: 'Admin agent execution',
  crypto_donations: 'Cryptocurrency donations',
};

const settled = (ready: boolean, explanation: string) => ({ ready, explanation });
export async function probeLiveProviders(sr?: any) {
  const payPalId = secrets.get('PAYPAL_CLIENT_ID');
  const payPalSecret = secrets.get('PAYPAL_CLIENT_SECRET');
  const payPalConfigured = !!(payPalId && payPalSecret && secrets.get('PAYPAL_MODE') === 'live');
  let paypal = false;
  let payouts = false;
  if (payPalConfigured) {
    try {
      paypal = await isLivePayPalRestReady();
      if (paypal) payouts = await isLivePayPalPayoutReady();
    } catch (_) { /* Fail closed. */ }
  }
  let paypalSubscriptions = false;
  if (paypal && sr) {
    try {
      const hooks = await sr.entities.PayPalBillingWebhook.filter({ provider: 'paypal', account_ref: IFUND_PAYPAL_ACCOUNT_REF });
      const verifiedHooks = await Promise.all((hooks || []).map(async (h: any) => {
        if (!h.webhook_id || !h.url) return false;
        const remote = await paypalBillingRequest('/v1/notifications/webhooks/' + encodeURIComponent(h.webhook_id)).catch(() => null);
        const events = new Set((remote?.event_types || []).map((event: any) => event.name));
        return remote?.url === h.url && (events.has('*') ||
          ['BILLING.SUBSCRIPTION.ACTIVATED','BILLING.SUBSCRIPTION.CANCELLED','PAYMENT.SALE.COMPLETED'].every(event => events.has(event)));
      }));
      if (verifiedHooks.some(Boolean)) {
        const prices = subscriptionPrices();
        const results = await Promise.all(prices.map((price: any) => verifiedPayPalPlan(sr, price.tier, price.interval).catch(() => null)));
        paypalSubscriptions = prices.length > 0 && results.every(Boolean);
      }
    } catch (_) { /* Fail closed: subscription catalog is not verified. */ }
  }
  // This is configuration presence only: until the provider verifies IFund's
  // pooled donations and settlement agreement, it must never enable transfers.
  const nowpaymentsConfigured = !!(secrets.get('NOWPAYMENTS_API_KEY') && secrets.get('NOWPAYMENTS_IPN_SECRET'));
  const reownConfigured = !!secrets.get('REOWN_PROJECT_ID');
  const openaiConfigured = !!secrets.get('OPENAI_API_KEY');
  return {
    paypal_checkout: settled(paypal, paypal ? 'Verified live PayPal REST account' : 'Live PayPal account verification required'),
    paypal_payouts: settled(payouts, payouts ? 'Verified PayPal payouts' : 'PayPal payouts must be verified separately'),
    paypal_subscriptions: settled(paypalSubscriptions, paypalSubscriptions ? 'Verified PayPal billing plans and webhook' : 'PayPal billing plans and webhook verification required'),
    stripe_checkout: settled(false, 'Stripe has been retired from IFund checkout.'),
    crypto_gateway: settled(false, 'Awaiting a non-Stripe crypto settlement provider and verified accounting.'),
    nowpayments: settled(false, nowpaymentsConfigured ? 'Credentials present; merchant approval, IPN and settlement are not verified' : 'NOWPayments merchant account, API key and IPN setup required'),
    reown: settled(false, reownConfigured ? 'Server-side project reference exists; website allowlist and client configuration unverified' : 'Reown Project ID and allowed website origins required'),
    openai: settled(false, openaiConfigured ? 'API key configured; agent execution not independently verified' : 'An authorized AI execution provider and runtime test are required'),
  };
}

export function assessFeatureReadiness(key: string, providers: Awaited<ReturnType<typeof probeLiveProviders>>, registry: any[] = []) {
  const p = providers;
  const pp = p.paypal_checkout.ready;
  const st = false; // Retired payment rail. Never use it to enable collection or purchases.
  const payout = p.paypal_payouts.ready;
  const registryActive = (platform: string) => registry.some((r: any) =>
    String(r.platform || '').toLowerCase() === platform &&
    String(r.status || '').toUpperCase() === 'ACTIVE' &&
    Number.isFinite(Date.parse(r.last_successful_verification)) &&
    Date.now() - Date.parse(r.last_successful_verification) < 24 * 60 * 60 * 1000);
  const social = ['facebook_pages','linkedin','discord','instagram','tiktok'].some(registryActive);
  const connectedNetwork = ['facebook_pages','linkedin','discord','instagram','tiktok','wix','github'].some(registryActive);
  const known: Record<string, ReturnType<typeof settled>> = {
    public_campaign_fundraising: settled(pp && payout, 'Requires verified PayPal donation processing and payout route'),
    payment_checkout_enabled: settled(pp, 'Requires verified PayPal business checkout'),
    paypal_checkout: settled(pp, p.paypal_checkout.explanation),
    google_pay_checkout: settled(false, 'Google Pay wallet processing has not been independently verified end to end'),
    apple_pay_checkout: settled(false, 'Apple Pay requires PayPal merchant approval, payment-domain registration, compatible device, and verified end-to-end settlement'),
    stripe_checkout: settled(st, p.stripe_checkout.explanation),
    recurring_donations: settled(false, 'Monthly campaign gifts are unavailable until PayPal recurring-giving support is verified'),
    subscription_checkout: settled(p.paypal_subscriptions.ready, 'Requires verified PayPal billing plans and signed subscription lifecycle events'),
    outbound_payout_execution: settled(payout, p.paypal_payouts.explanation),
    ai_campaign_assistant: settled(false, 'AI provider credentials and campaign-assistant runtime must be tested'),
    ai_outreach_agent: settled(false, 'AI runtime, consent and outbound messaging must be tested'),
    social_autopilot: settled(false, 'Posting permissions, consent and live publication must be verified'),
    cross_platform_publishing: settled(social, 'Requires at least one provider-verified social publishing connection'),
    managed_connections: settled(connectedNetwork, 'Requires provider-verified authorization; unverified tokens are not sufficient'),
    external_campaign_import: settled(false, 'Requires a successful authenticated import and ongoing synchronization'),
    external_fund_collection: settled(false, 'Requires external settlement, custody and reconciliation verification'),
    external_feed_mirroring: settled(false, 'Requires tested feed subscriptions and data provenance'),
    community_creation: settled(true, 'Native IFund capability; administrator can control availability'),
    institution_programs: settled(true, 'Native IFund capability; administrator can control availability'),
    admin_agent_execution: settled(false, 'Admin agent runtime not confirmed end to end'),
    crypto_donations: settled(p.crypto_gateway.ready, p.crypto_gateway.explanation),
  };
  return known[key] || settled(false, 'Not mapped to a live backend implementation');
}

export function liveFeatureSnapshot(key: string, flags: any[], providers: Awaited<ReturnType<typeof probeLiveProviders>>, registry: any[] = []) {
  const matching = flags.filter((r: any) => r.key === key);
  const flag = matching.length === 1 && matching[0].scope === FEATURE_SCOPES[key] ? matching[0] : null;
  const ready = assessFeatureReadiness(key, providers, registry);
  return {
    key,
    label: LIVE_FEATURE_NAMES[key] || key,
    scope: FEATURE_SCOPES[key] || null,
    flag_id: flag?.id || null,
    enabled: flag?.enabled === true,
    code_connected: CODE_CONNECTED_FEATURES.includes(key),
    provider_ready: ready.ready,
    detail: ready.explanation,
    state: !CODE_CONNECTED_FEATURES.includes(key) ? 'not_implemented' :
      matching.length && !flag ? 'configuration_conflict' :
      !flag ? 'switch_missing' : !ready.ready ? 'setup_needed' :
      flag.enabled === true ? 'live_enabled' : 'ready_off',
  };
}