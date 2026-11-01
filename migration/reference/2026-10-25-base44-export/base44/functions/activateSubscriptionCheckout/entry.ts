import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { subscriptionPrices } from '../../shared/subscriptionCatalog.js';
import { verifiedPayPalPlan, paypalBillingRequest, IFUND_PAYPAL_ACCOUNT_REF } from '../../shared/paypalSubscriptions.ts';
const NEEDED_EVENTS = [
  'BILLING.SUBSCRIPTION.ACTIVATED', 'BILLING.SUBSCRIPTION.UPDATED',
  'BILLING.SUBSCRIPTION.SUSPENDED', 'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.EXPIRED', 'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
  'PAYMENT.SALE.COMPLETED', 'PAYMENT.SALE.REFUNDED', 'PAYMENT.SALE.REVERSED',
];
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;
    if (user.role !== 'admin') return Response.json({ error: 'Administrator access required.' }, { status: 403 });
    if (req.method !== 'POST') return Response.json({ error: 'POST required.' }, { status: 405 });
    const sr = base44.asServiceRole;
    // Only offer plans independently verified against live PayPal pricing.
    // One owner-provided plan can be activated without forcing creation of
    // nine unrelated PayPal plans. Each checkout re-verifies its chosen plan.
    let verifiedCount = 0;
    for (const price of subscriptionPrices()) {
      if (await verifiedPayPalPlan(sr, price.tier, price.interval)) verifiedCount++;
    }
    if (verifiedCount === 0) return Response.json({
      error: 'Subscription checkout remains disabled until at least one live PayPal price is verified.',
    }, { status: 503 });
    const hooks = await sr.entities.PayPalBillingWebhook.filter({ provider: 'paypal', account_ref: IFUND_PAYPAL_ACCOUNT_REF });
    const hook = (hooks || []).find(row => row.webhook_id && row.url);
    if (!hook) return Response.json({ error: 'A live PayPal billing webhook must be installed first.' }, { status: 503 });
    const remote = await paypalBillingRequest('/v1/notifications/webhooks/' + encodeURIComponent(hook.webhook_id));
    const events = new Set((remote.event_types || []).map(row => row.name));
    if (remote.url !== hook.url || !NEEDED_EVENTS.every(name => events.has(name) || events.has('*'))) {
      return Response.json({ error: 'PayPal recurring payment webhook is not configured for all required billing events.' }, { status: 503 });
    }
    const probe = await fetch(hook.url, { redirect: 'error' }).then(r => r.ok ? r.json() : null).catch(() => null);
    if (probe?.type !== 'ifund_paypal_subscription_webhook' || probe.ready !== true) {
      return Response.json({ error: 'PayPal webhook is not reachable at the verified IFund endpoint.' }, { status: 503 });
    }
    const flags = await sr.entities.FeatureFlag.filter({ key: 'subscription_checkout' });
    const selected = (flags || [])[0];
    if (selected) await sr.entities.FeatureFlag.update(selected.id, { enabled: true, scope: 'beta' });
    else await sr.entities.FeatureFlag.create({ key: 'subscription_checkout', label: 'Subscription checkout', enabled: true, scope: 'beta' });
    return Response.json({ ok: true, enabled: true, matched_paypal_prices: verifiedCount, webhook_verified: true });
  } catch (error) {
    console.error('activateSubscriptionCheckout:', error?.name || 'UnknownError');
    return Response.json({ error: 'Subscription checkout remains disabled. The PayPal live billing and webhook checks did not pass.' }, { status: 503 });
  }
}