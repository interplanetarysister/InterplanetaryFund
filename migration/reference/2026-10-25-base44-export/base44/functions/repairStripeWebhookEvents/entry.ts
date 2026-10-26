import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
const REQUIRED = [
  'checkout.session.completed','checkout.session.async_payment_succeeded',
  'invoice.paid','customer.subscription.updated','customer.subscription.deleted',
  'charge.refunded','charge.dispute.created',
];
// No billing, spending, account duplication, or key replacement.
// This changes ONLY an existing IFund endpoint's event subscriptions and
// retains its signing secret. Stripe never returns that secret after creation.
export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') return Response.json({ error: 'Administrator access required.' }, { status: 403 });
    if (req.method !== 'POST') return Response.json({ error: 'POST required.' }, { status: 405 });
    const key = String(secrets.get('STRIPE_SECRET_KEY') || '');
    const secret = String(secrets.get('STRIPE_WEBHOOK_SECRET') || '');
    if (!key.startsWith('sk_live_') || !secret.startsWith('whsec_')) {
      return Response.json({ error: 'Stripe live API key and webhook signing secret are required. No changes made.' }, { status: 503 });
    }
    const stripe = new Stripe(key);
    const account = await stripe.accounts.retrieve();
    if (account.charges_enabled !== true) return Response.json({ error: 'Stripe business merchant is not verified for payment processing.' }, { status: 409 });
    const rows = await stripe.webhookEndpoints.list({ limit: 100 });
    if (rows.has_more) return Response.json({ error: 'Too many Stripe webhook endpoints for automatic repair; review is required.' }, { status: 409 });
    const allowed = new Set([
      'https://interplanetaryfund.base44.app/functions/stripeWebhook',
      'https://interplanetaryfund.com/functions/stripeWebhook',
      'https://www.interplanetaryfund.com/functions/stripeWebhook',
    ]);
    const matching = (rows.data || []).filter(row =>
      row.livemode === true && allowed.has(row.url) && row.status === 'enabled');
    if (matching.length !== 1) {
      return Response.json({ error: 'A unique enabled IFund webhook was not found. No endpoint was created or modified.', matching_count: matching.length }, { status: 409 });
    }
    const endpoint = matching[0];
    const current = new Set(endpoint.enabled_events || []);
    if (current.has('*')) return Response.json({ ok: true, changed: false, covered: true });
    const added = REQUIRED.filter(name => !current.has(name));
    if (!added.length) return Response.json({ ok: true, changed: false, covered: true });
    const updated = await stripe.webhookEndpoints.update(endpoint.id, {
      enabled_events: [...current, ...added],
    });
    const set = new Set(updated.enabled_events || []);
    const covered = updated.status === 'enabled' && (set.has('*') || REQUIRED.every(x => set.has(x)));
    if (!covered) throw new Error('Stripe webhook event update was not verified.');
    return Response.json({
      ok: true, changed: true, covered: true, added_events: added,
      message: 'Existing Stripe webhook event subscriptions updated. Signing-secret delivery tests must still pass before money is credited.',
    });
  } catch (error) {
    console.error('repairStripeWebhookEvents:', error?.name || 'UnknownError');
    return Response.json({ error: 'Stripe webhook repair did not complete. No payment, plan, or payout was started.' }, { status: 503 });
  }
}
