import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { subscriptionPrices } from '../../shared/subscriptionCatalog.js';
import { IFUND_PAYPAL_ACCOUNT_REF, paypalBillingRequest, verifiedPayPalPlan } from '../../shared/paypalSubscriptions.ts';
import { isLivePayPalRestReady } from '../../shared/paypal.ts';
import { effectiveSubscription } from '../../shared/subscriptionEntitlements.ts';

// Only provider-verified live plans can be offered. Local catalog rows alone do
// not prove that a PayPal business account can accept a subscription.
const REQUIRED_EVENTS = [
  'BILLING.SUBSCRIPTION.ACTIVATED', 'BILLING.SUBSCRIPTION.UPDATED',
  'BILLING.SUBSCRIPTION.SUSPENDED', 'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.EXPIRED', 'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
  'PAYMENT.SALE.COMPLETED', 'PAYMENT.SALE.REFUNDED', 'PAYMENT.SALE.REVERSED',
];
export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in to see subscription payments.' }, { status: 401 });
    const sr = base44.asServiceRole;
    const eligible = user.role !== 'admin' && !effectiveSubscription(user).active &&
      user.subscription_status !== 'past_due';
    const trialEligible = eligible && !user.trial_end && !user.premium_trial_started_at &&
      !user.stripe_customer_id && !user.paypal_subscription_id;
    const approved = await sr.entities.NonprofitSubscriptionApproval
      .filter({ user_id: user.id }).catch(() => []);
    const nonprofitApproved = (approved || []).some((row: any) => row.status === 'approved');
    const live = await isLivePayPalRestReady();
    let webhookReady = false;
    if (live) {
      const hooks = await sr.entities.PayPalBillingWebhook.filter({
        provider: 'paypal', account_ref: IFUND_PAYPAL_ACCOUNT_REF,
      }).catch(() => []);
      for (const hook of hooks || []) {
        if (!hook.webhook_id || !hook.url) continue;
        const remote = await paypalBillingRequest(
          '/v1/notifications/webhooks/' + encodeURIComponent(hook.webhook_id)
        ).catch(() => null);
        const events = new Set((remote?.event_types || []).map((item: any) => item.name));
        if (remote?.url === hook.url && REQUIRED_EVENTS.every(e => events.has(e) || events.has('*'))) {
          webhookReady = true;
          break;
        }
      }
    }
    const prices = subscriptionPrices();
    const checked = live && webhookReady ? await Promise.all(prices.map(async p =>
      !!(await verifiedPayPalPlan(sr, p.tier, p.interval).catch(() => null)))) : prices.map(() => false);
    // Keep locally saved catalog mappings distinct from real provider-verified
    // checkout readiness. A missing webhook must not make saved mappings look
    // as though they vanished, nor may mappings enable checkout by themselves.
    const adminMappings = user.role === "admin"
      ? await sr.entities.SubscriptionPlanMapping.filter({
          provider: "paypal", account_ref: IFUND_PAYPAL_ACCOUNT_REF,
        }).catch(() => null)
      : null;
    const savedMappingCount = Array.isArray(adminMappings)
      ? new Set(adminMappings.map((row: any) => `${row.tier}:${row.interval}`)).size
      : null;
    const plans = prices.map((p, i) => ({
      tier: p.tier, interval: p.interval, amount_cents: p.amount_cents,
      verified: checked[i],
      available: checked[i] && eligible && (p.tier !== 'nonprofit' || nonprofitApproved),
      currency: 'USD',
    }));
    return Response.json({
      provider: 'paypal', live_configured: live, webhook_configured: webhookReady,
      readiness: !live ? 'paypal_rest_unavailable' : !webhookReady ? 'webhook_not_verified' : 'verification_checked',
      ...(user.role === 'admin' ? { saved_plan_mapping_count: savedMappingCount } : {}),
      nonprofit_approved: nonprofitApproved, trial_eligible: trialEligible,
      plans,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('getPayPalSubscriptionOptions:', error?.name || 'UnknownError');
    return Response.json({
      provider: 'paypal', live_configured: false, webhook_configured: false,
      readiness: 'status_unavailable', trial_eligible: false, plans: [],
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  }
}
