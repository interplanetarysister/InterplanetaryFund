import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';

const allowed = new Set(['active', 'paused', 'cancelled']);

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const sr = base44.asServiceRole;
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Authentication required.' }, { status: 401 });

    const { donation_id, recurring_status } = await req.json().catch(() => ({}));
    if (!donation_id || !allowed.has(recurring_status)) {
      return Response.json({ error: 'Invalid recurring donation request.' }, { status: 400 });
    }

    const donation = await sr.entities.Donation.get(donation_id).catch(() => null);
    if (!donation || donation.donor_user_id !== user.id) {
      return Response.json({ error: 'Recurring donation not found.' }, { status: 404 });
    }
    if (donation.payment_verified !== true || !donation.is_recurring || donation.payment_method !== 'stripe') {
      return Response.json({ error: 'Only verified Stripe recurring gifts can be managed here.' }, { status: 400 });
    }

    // Renewal mirrors carry invoice ids. Resolve the original Checkout Session
    // for this donor/campaign so the actual Stripe subscription remains the authority.
    const related = await sr.entities.Donation.filter({
      donor_user_id: user.id,
      campaign_id: donation.campaign_id,
      payment_method: 'stripe',
      is_recurring: true,
      payment_verified: true,
    }, 'created_date', 1000) || [];
    const origin = related.find((d) => String(d.stripe_session_id || '').startsWith('cs_'));
    if (!origin) return Response.json({ error: 'Subscription reference is unavailable. Contact support.' }, { status: 409 });

    const stripe = new Stripe(secrets.get('STRIPE_SECRET_KEY'));
    const session = await stripe.checkout.sessions.retrieve(origin.stripe_session_id);
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    if (!subscriptionId) return Response.json({ error: 'Subscription reference is unavailable. Contact support.' }, { status: 409 });

    if (recurring_status === 'cancelled') {
      await stripe.subscriptions.cancel(subscriptionId);
    } else if (recurring_status === 'paused') {
      await stripe.subscriptions.update(subscriptionId, { pause_collection: { behavior: 'void' } });
    } else {
      await stripe.subscriptions.update(subscriptionId, { pause_collection: null });
    }

    // Mirror provider-confirmed control state across this recurring series.
    for (const row of related) {
      await sr.entities.Donation.update(row.id, { recurring_status }).catch(() => {});
    }
    return Response.json({ ok: true, recurring_status });
  } catch (error) {
    console.error('manageRecurringDonation error:', error?.message || error);
    return Response.json({ error: 'Unable to update recurring donation safely.' }, { status: 503 });
  }
}
