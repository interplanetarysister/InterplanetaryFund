import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { captureOrder } from '../../shared/paypal.ts';

// Captures a PayPal order that was confirmed via Google Pay, then records the
// donation in the ledger, updates campaign totals, and notifies the creator —
// mirroring recordDonation so Google Pay gifts land in the same ledger.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    const { order_id, campaign_id, donor_name, message, is_recurring } = await req.json();
    if (!order_id || !campaign_id) {
      return Response.json({ error: 'Order id and campaign are required' }, { status: 400 });
    }

    const cap = await captureOrder(order_id);
    if (cap.status !== 'COMPLETED') {
      return Response.json({ error: 'Payment was not completed', status: cap.status }, { status: 402 });
    }

    const campaign = await sr.entities.Campaign.get(campaign_id);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

    let donor = null;
    try { donor = await base44.auth.me(); } catch (_) { /* supporters may be signed out */ }

    const value = cap.amount;
    const donation = await sr.entities.Donation.create({
      campaign_id,
      campaign_title: campaign.title,
      amount: value,
      donor_name: donor_name || cap.payer_name || donor?.full_name || 'Anonymous',
      message: message || '',
      is_recurring: !!is_recurring,
      ...(is_recurring ? { recurring_status: 'active' } : {}),
      donor_user_id: donor?.id,
      payment_method: 'paypal',
      stripe_session_id: order_id, // external reference id (PayPal order id)
    });

    await sr.entities.Campaign.update(campaign_id, {
      raised_amount: (campaign.raised_amount || 0) + value,
      donor_count: (campaign.donor_count || 0) + 1,
    });

    if (campaign.created_by_id) {
      await sr.entities.Notification.create({
        user_id: campaign.created_by_id,
        title: 'New donation received',
        body: `${donation.donor_name} gave $${value.toLocaleString()} to "${campaign.title}" via Google Pay`,
        type: 'donation',
        link: `/campaign/${campaign_id}`,
      });
    }

    return Response.json({ ok: true, donation_id: donation.id, amount: value });
  } catch (error) {
    console.error('capturePayPalOrder error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}