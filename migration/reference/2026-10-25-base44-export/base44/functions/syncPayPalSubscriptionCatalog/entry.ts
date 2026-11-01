import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { subscriptionPrices, subscriptionPrice, providerPriceIsExact, CATALOG_VERSION } from '../../shared/subscriptionCatalog.js';
import { paypalBillingRequest, IFUND_PAYPAL_ACCOUNT_REF, getPayPalBillingPlan, IFUND_OWNER_BASIC_MONTHLY_PLAN_ID } from '../../shared/paypalSubscriptions.ts';

// Explicit administrator action: provision the ten live recurring PayPal
// prices from IFund's canonical catalog. Never auto-run this on public reads.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const admin = guard.user;
    if (admin.role !== 'admin') return Response.json({ error: 'Administrator access required.' }, { status: 403 });
    if (req.method !== 'POST') return Response.json({ error: 'POST required.' }, { status: 405 });
    const sr = base44.asServiceRole;
    const catalog = subscriptionPrices();
    const report: any[] = [];
    const products: Record<string, string> = {};
    // Discover saved, previously verified IDs first. PayPal remains the
    // authoritative source for live price and billing status.
    const allRows = await sr.entities.SubscriptionPlanMapping.filter({ provider: 'paypal', account_ref: IFUND_PAYPAL_ACCOUNT_REF }).catch(() => []);
    // The owner supplied the existing $12/month PayPal Button Factory plan.
    // Never generate a replacement Basic monthly plan during bulk setup:
    // the owner-provided plan must be accessible via the connected live REST
    // app and match the IFund catalog, or this setup fails without duplicating.
    const ownerBasicMonthlyId = IFUND_OWNER_BASIC_MONTHLY_PLAN_ID;
    for (const expected of catalog) {
      const matchingTier = (allRows || []).filter((r: any) =>
        r.tier === expected.tier && r.interval === expected.interval);
      const existing = matchingTier.find((r: any) =>
        r.catalog_version === CATALOG_VERSION && r.amount_cents === expected.amount_cents) ||
        (expected.tier === 'basic' && expected.interval === 'monthly'
          ? matchingTier.find((r: any) => r.plan_id === ownerBasicMonthlyId || !r.plan_id) : null);
      let activePlan: any = null;
      if (existing?.plan_id) {
        activePlan = await getPayPalBillingPlan(existing.plan_id).catch(() => null);
        if (!providerPriceIsExact(activePlan, expected) || activePlan.product_id !== existing.product_id) {
          return Response.json({ error: 'An existing PayPal plan does not match IFund pricing. No prices were changed.', tier: expected.tier, interval: expected.interval }, { status: 409 });
        }
        if (expected.tier === 'basic' && expected.interval === 'monthly' &&
            (existing.catalog_version !== CATALOG_VERSION || existing.amount_cents !== expected.amount_cents ||
             existing.currency !== 'USD')) {
          // Provider verified the unchanged billing amount; repair only the
          // local catalog metadata, never a customer's PayPal billing plan.
          await sr.entities.SubscriptionPlanMapping.update(existing.id, {
            catalog_version: CATALOG_VERSION, amount_cents: expected.amount_cents,
            currency: 'USD', verified_at: new Date().toISOString(),
          });
        }
        products[expected.tier] = existing.product_id;
        report.push({ tier: expected.tier, interval: expected.interval, amount_cents: expected.amount_cents, product_id: existing.product_id, plan_id: existing.plan_id, status: 'verified' });
        continue;
      }
      if (expected.tier === 'basic' && expected.interval === 'monthly') {
        // First reuse the owner's existing $12/month Button Factory plan, but
        // some merchant apps cannot read a plan created under another live app.
        // When unavailable, provision a verified equivalent under the CURRENT
        // authorized PayPal business; never open or substitute another merchant.
        const supplied = await getPayPalBillingPlan(ownerBasicMonthlyId).catch(() => null);
        if (supplied?.id === ownerBasicMonthlyId &&
            providerPriceIsExact(supplied, expected) && supplied.product_id) {
          const duplicate = (allRows || []).some((row: any) =>
            row.plan_id === ownerBasicMonthlyId && (row.tier !== expected.tier || row.interval !== expected.interval));
          if (duplicate) return Response.json({ error: 'The owner plan is assigned to another tier.' }, { status: 409 });
          const mapping = {
            provider: 'paypal', tier: expected.tier, interval: expected.interval,
            currency: 'USD', amount_cents: expected.amount_cents, catalog_version: CATALOG_VERSION,
            account_ref: IFUND_PAYPAL_ACCOUNT_REF, product_id: supplied.product_id,
            plan_id: ownerBasicMonthlyId, verified_at: new Date().toISOString(),
          };
          if (existing?.id) await sr.entities.SubscriptionPlanMapping.update(existing.id, mapping);
          else await sr.entities.SubscriptionPlanMapping.create(mapping);
          products[expected.tier] = supplied.product_id;
          report.push({ tier: expected.tier, interval: expected.interval,
            amount_cents: expected.amount_cents, product_id: supplied.product_id,
            plan_id: ownerBasicMonthlyId, status: 'adopted_existing_and_verified' });
          continue;
        }
        // A missing owner plan is not a reason to replace the merchant
        // account. Continue to the idempotent product + plan provisioning
        // path below using the existing authorized live PayPal credentials.
      }
      // Reuse the product attached to the other billing interval for this tier.
      let productId = products[expected.tier] ||
        (allRows || []).find((r: any) => r.tier === expected.tier && r.catalog_version === CATALOG_VERSION && r.product_id)?.product_id;
      if (!productId) {
        const product = await paypalBillingRequest('/v1/catalogs/products', {
          method: 'POST', requestId: 'IFUND_PRODUCT_' + CATALOG_VERSION.replace(/[^a-z0-9]/ig, '') + '_' + expected.tier,
          body: { name: 'Interplanetary Fund — ' + expected.name, description: 'IFund AI fundraising subscription: ' + expected.name, type: 'SERVICE', category: 'SOFTWARE', home_url: 'https://interplanetaryfund.com' },
        });
        if (!product?.id) throw new Error('PayPal did not return a product identifier.');
        productId = product.id;
      }
      products[expected.tier] = productId;
      const plan = await paypalBillingRequest('/v1/billing/plans', {
        method: 'POST',
        requestId: 'IFUND_PLAN_' + CATALOG_VERSION.replace(/[^a-z0-9]/ig, '') + '_' + expected.tier + '_' + expected.interval,
        body: {
          product_id: productId,
          name: expected.name + ' — ' + (expected.interval === 'monthly' ? 'Monthly' : 'Annual'),
          description: 'Interplanetary Fund ' + expected.name + ' subscription (' + expected.interval + ')',
          billing_cycles: [{
            frequency: { interval_unit: expected.interval === 'monthly' ? 'MONTH' : 'YEAR', interval_count: 1 },
            tenure_type: 'REGULAR', sequence: 1, total_cycles: 0,
            pricing_scheme: { fixed_price: { value: (expected.amount_cents / 100).toFixed(2), currency_code: 'USD' } },
          }],
          payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 3 },
        },
      });
      if (!plan?.id) throw new Error('PayPal did not return a billing plan identifier.');
      // PayPal can initially return CREATED; the activation endpoint makes
      // the plan usable. Never advertise it as available before verification.
      const inspect = await getPayPalBillingPlan(plan.id);
      if (inspect?.status === 'CREATED') {
        await paypalBillingRequest('/v1/billing/plans/' + encodeURIComponent(plan.id) + '/activate', { method: 'POST' });
      }
      const verified = await getPayPalBillingPlan(plan.id);
      if (!providerPriceIsExact(verified, expected) || verified.product_id !== productId) {
        throw new Error('PayPal plan creation returned a non-matching price; checkout remains disabled for this plan.');
      }
      const row = {
        provider: 'paypal', tier: expected.tier, interval: expected.interval, currency: 'USD',
        amount_cents: expected.amount_cents, catalog_version: CATALOG_VERSION,
        account_ref: IFUND_PAYPAL_ACCOUNT_REF, product_id: productId,
        plan_id: plan.id, verified_at: new Date().toISOString(),
      };
      if (existing?.id) await sr.entities.SubscriptionPlanMapping.update(existing.id, row);
      else await sr.entities.SubscriptionPlanMapping.create(row);
      report.push({ tier: expected.tier, interval: expected.interval, amount_cents: expected.amount_cents, product_id: productId, plan_id: plan.id, status: 'created_and_verified' });
    }
    return Response.json({ ok: report.length === catalog.length, account_ref: IFUND_PAYPAL_ACCOUNT_REF, catalog_version: CATALOG_VERSION, prices: report });
  } catch (error) {
    console.error('syncPayPalSubscriptionCatalog:', error?.name || 'UnknownError');
    return Response.json({ error: 'PayPal catalog provisioning could not finish. Existing verified plans are retained; retry safely.' }, { status: 503 });
  }
}