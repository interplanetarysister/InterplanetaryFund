import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Returns the donation ledger for a campaign with row-level privacy enforced
// server-side. Only provider-verified/confirmed donations are returned by
// default. Owners/admins may explicitly request pending records for a separate
// review UI, but pending/manual reports must never masquerade as completed gifts.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    let user = null;
    try { user = await base44.auth.me(); } catch (_) { /* public visitors */ }

    const body = await req.json().catch(() => ({}));
    const campaign_id = body.campaign_id;
    const include_pending = body.include_pending === true;
    if (!campaign_id) return Response.json({ error: 'Campaign is required' }, { status: 400 });

    const campaign = await sr.entities.Campaign.get(campaign_id).catch(() => null);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

    const isOwner = !!user && campaign.created_by_id === user.id;
    const isAdmin = !!user && user.role === 'admin';
    if (campaign.status === 'draft' && !isOwner && !isAdmin) {
      return Response.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const allDonations = await sr.entities.Donation.filter({ campaign_id }, '-created_date', 1000) || [];
    const confirmed = allDonations.filter((d) => d.payment_verified === true);
    const pending = allDonations.filter((d) => d.payment_verified !== true);

    if (isOwner || isAdmin) {
      return Response.json({
        donations: include_pending ? allDonations : confirmed,
        pending_count: pending.length,
      });
    }

    // Public sanitized view: confirmed gifts only, donor-approved display fields.
    const safe = confirmed.map((d) => ({
      donor_name: d.donor_name || 'Anonymous',
      amount: d.amount,
      is_recurring: !!d.is_recurring,
      message: d.message || '',
      created_date: d.created_date,
    }));
    return Response.json({ donations: safe });
  } catch (error) {
    console.error('getCampaignDonations error:', error && error.message ? error.message : error);
    return Response.json({ error: 'Unable to load donations.' }, { status: 500 });
  }
}
