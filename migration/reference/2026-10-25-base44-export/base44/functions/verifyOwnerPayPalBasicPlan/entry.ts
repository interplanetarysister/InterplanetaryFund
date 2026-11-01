import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { subscriptionPrice, providerPriceIsExact } from '../../shared/subscriptionCatalog.js';
import { getPayPalBillingPlan, IFUND_PAYPAL_ACCOUNT_REF, IFUND_OWNER_BASIC_MONTHLY_PLAN_ID } from '../../shared/paypalSubscriptions.ts';

// The $12/month PayPal plan supplied by the IFund owner (2026-10-08).
// This is a candidate identifier, NOT evidence that a plan is active or
// belongs to IFund. PayPal's LIVE business REST API must verify it before
// any catalog mapping is written or subscribers can check out.
const PROVIDED_BASIC_MONTHLY_PLAN_ID = IFUND_OWNER_BASIC_MONTHLY_PLAN_ID;

export default async function(req) {
  if (req.method !== 'POST') return Response.json({ error: 'POST required.' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    if (guard.user.role !== 'admin') return Response.json({ error: 'Administrator access required.' }, { status: 403 });

    const expected = subscriptionPrice('basic', 'monthly');
    // Read-only provider verification. Do NOT create another plan or initiate a charge.
    const plan = await getPayPalBillingPlan(PROVIDED_BASIC_MONTHLY_PLAN_ID);
    if (plan?.id !== PROVIDED_BASIC_MONTHLY_PLAN_ID ||
        !providerPriceIsExact(plan, expected) ||
        !/^PROD-[A-Za-z0-9_-]{5,}$/.test(String(plan?.product_id || ''))) {
      return Response.json({
        error: 'The supplied PayPal plan could not be verified as an active USD $12.00 monthly plan on the connected live business account. No mapping was changed.',
      }, { status: 409 });
    }

    const sr = base44.asServiceRole;
    const allRows = await sr.entities.SubscriptionPlanMapping.filter({
      provider: 'paypal', account_ref: IFUND_PAYPAL_ACCOUNT_REF,
    });
    if ((allRows || []).some(row => row.plan_id === PROVIDED_BASIC_MONTHLY_PLAN_ID &&
      (row.tier !== 'basic' || row.interval !== 'monthly'))) {
      return Response.json({ error: 'This PayPal plan is already linked to another subscription tier.' }, { status: 409 });
    }
    const sameTier = (allRows || []).filter(row => row.tier === 'basic' && row.interval === 'monthly');
    if (sameTier.some(row => row.plan_id && row.plan_id !== PROVIDED_BASIC_MONTHLY_PLAN_ID)) {
      // Replacing a live mapping would strand existing recurring subscribers.
      return Response.json({ error: 'A different Basic monthly PayPal plan is already saved. Reconcile existing subscriptions before replacing it.' }, { status: 409 });
    }
    const mapping = {
      provider: 'paypal',
      tier: 'basic',
      interval: 'monthly',
      currency: 'USD',
      amount_cents: expected.amount_cents,
      catalog_version: expected.version,
      account_ref: IFUND_PAYPAL_ACCOUNT_REF,
      product_id: plan.product_id,
      plan_id: PROVIDED_BASIC_MONTHLY_PLAN_ID,
      verified_at: new Date().toISOString(),
    };
    if (sameTier[0]?.id) await sr.entities.SubscriptionPlanMapping.update(sameTier[0].id, mapping);
    else await sr.entities.SubscriptionPlanMapping.create(mapping);
    return Response.json({ ok: true, tier: 'basic', interval: 'monthly', plan_id: PROVIDED_BASIC_MONTHLY_PLAN_ID, amount_cents: expected.amount_cents, status: 'provider_verified', no_charge_created: true });
  } catch (error) {
    console.error('verifyOwnerPayPalBasicPlan:', error?.name || 'UnknownError');
    return Response.json({ error: 'The supplied PayPal plan could not be verified using IFund live business credentials. No mapping was changed.' }, { status: 503 });
  }
}
