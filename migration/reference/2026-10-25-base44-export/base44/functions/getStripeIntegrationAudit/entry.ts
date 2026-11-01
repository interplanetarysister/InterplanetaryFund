import Stripe from 'npm:stripe@17.7.0';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { subscriptionPrices } from '../../shared/subscriptionCatalog.js';
import { resolveStripeSubscriptionPrice } from '../../shared/stripeSubscriptionCatalog.ts';
import { stripeCryptoGatewayReadiness } from '../../shared/stripeCryptoReadiness.ts';

const NEEDED_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'invoice.paid',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'charge.refunded',
  'charge.dispute.created',
];

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') return Response.json({ error: 'Administrator access required.' }, { status: 403 });
    if (req.method !== 'POST') return Response.json({ error: 'POST required.' }, { status: 405 });
    const liveKey = String(secrets.get('STRIPE_SECRET_KEY') || '');
    const hookSecretPresent = Boolean(secrets.get('STRIPE_WEBHOOK_SECRET'));
    if (!liveKey.startsWith('sk_live_')) return Response.json({ ok: false, reason: 'Existing live Stripe API credentials need verification.', key_present: !!liveKey, live_key: false });
    const stripe = new Stripe(liveKey);
    // Read-only provider inspection. Never creates a customer, charge, price,
    // product, paid plan, tax value, payout or new API key.
    const [account, hooks, products, configurations, crypto] = await Promise.all([
      stripe.accounts.retrieve(),
      stripe.webhookEndpoints.list({ limit: 100 }),
      stripe.products.list({ limit: 100, active: true }),
      stripe.paymentMethodConfigurations.list({ limit: 100 }),
      stripeCryptoGatewayReadiness(true),
    ]);
    const priceResults = await Promise.all(subscriptionPrices().map(async (expected) => {
      const found = await resolveStripeSubscriptionPrice(base44.asServiceRole, stripe, account.id, expected.tier, expected.interval);
      return { tier: expected.tier, interval: expected.interval,
        price_id: found?.id || null,
        active: found?.price?.active === true, currency: 'usd',
        amount_cents: expected.amount_cents, matches_ifund: !!found };
    }));
    const expectedUrls = [
      'https://interplanetaryfund.base44.app/functions/stripeWebhook',
      'https://interplanetaryfund.com/functions/stripeWebhook',
      'https://www.interplanetaryfund.com/functions/stripeWebhook',
    ];
    const webhookRows = (hooks.data || []).map(h => {
      const eventTypes = new Set(h.enabled_events || []);
      return {
        endpoint_id: h.id,
        url: h.url,
        status: h.status,
        livemode: h.livemode,
        is_ifund: expectedUrls.includes(h.url),
        missing_events: NEEDED_EVENTS.filter(e => !eventTypes.has('*') && !eventTypes.has(e)),
        signing_secret_present_in_ifund: hookSecretPresent,
      };
    });
    const identityDue = account.requirements?.currently_due || [];
    const accountIdentity = {
      merchant_country: account.country || null,
      business_type: account.business_type || null,
      charges_enabled: account.charges_enabled === true,
      payouts_enabled: account.payouts_enabled === true,
      details_submitted: account.details_submitted === true,
      company_tax_id_provided: account.company?.tax_id_provided === true,
      tax_identity_action_required: identityDue.some(k => /tax_id|tax_identifier|business_tax_id|company\.tax_id/.test(k)),
      requirements_due_count: identityDue.length,
    };
    // Never surface actual taxpayer identification or payment account details.
    const subscriptionCatalog = {
      existing_products: (products.data || []).filter(p => /Interplanetary Fund|IFund/i.test(String(p.name || '')))
        .map(p => ({ id: p.id, name: p.name, active: p.active })),
      verified_existing_prices: priceResults.filter(p => p.matches_ifund).length,
      configured_existing_prices: priceResults,
      total_expected_prices: 10,
    };
    const methods = (configurations.data || []).filter(c => c.livemode).map(c => ({
      config_id: c.id, active: c.active, is_default: c.is_default,
      cards: c.card?.available === true,
      stablecoins_available: c.crypto?.available === true,
      stablecoins_enabled: c.crypto?.display_preference?.value === 'on',
    }));
    const matching = webhookRows.filter(h => h.is_ifund && h.livemode);
    return Response.json({
      ok: true, account_connected: true,
      account: accountIdentity,
      live_api_key_present: true,
      webhook_signing_secret_present: hookSecretPresent,
      webhook_endpoints: webhookRows,
      correct_ifund_webhook_count: matching.length,
      webhook_event_coverage: matching.some(h => h.status === 'enabled' && h.missing_events.length === 0),
      expected_endpoint: expectedUrls[0],
      required_events: NEEDED_EVENTS,
      subscription_catalog: subscriptionCatalog,
      payment_methods: methods,
      crypto_checkout: {
        merchant_ready: crypto.account_ready, approved: crypto.approved,
        webhook_ready: crypto.webhook_ready, ready: crypto.ready,
        reason: crypto.reason,
      },
      charges_initiated: false,
      dashboard_url: 'https://dashboard.stripe.com',
      checked_at: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('getStripeIntegrationAudit:', error?.name || 'UnknownError');
    return Response.json({ error: 'Could not complete the read-only Stripe merchant audit. Check existing API key permissions.' }, { status: 503 });
  }
}
