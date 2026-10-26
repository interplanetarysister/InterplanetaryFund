import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { giftOf, round2 } from '../../shared/fees.js';

const CLEARING_DAYS = 7;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const campaignId = String(body.campaign_id || '');
    if (!campaignId) return Response.json({ error: 'Campaign is required.' }, { status: 400 });

    const sr = base44.asServiceRole;
    const campaign = await sr.entities.Campaign.get(campaignId).catch(() => null);
    if (!campaign) return Response.json({ error: 'Campaign not found.' }, { status: 404 });
    if (campaign.created_by_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Campaign not found.' }, { status: 404 });
    }

    const cutoff = Date.now() - CLEARING_DAYS * 86400000;
    const donations = await sr.entities.Donation.filter({ campaign_id: campaignId }, '-created_date', 5000).catch(() => []);
    if (donations.length >= 5000) {
      return Response.json({ error: 'Campaign donation history is too large for a safe single balance calculation.' }, { status: 409 });
    }

    let donationAvailable = 0;
    let donationClearing = 0;
    let donationWithdrawn = 0;
    for (const donation of donations) {
      if (donation.payment_verified !== true) continue;
      const amount = giftOf(donation);
      if (donation.withdrawal_id) {
        donationWithdrawn += amount;
        continue;
      }
      if (donation.cleared === true) {
        donationAvailable += amount;
        continue;
      }
      if (donation.is_institutional) continue;
      const createdAt = new Date(donation.created_date || 0).getTime();
      if (createdAt <= cutoff) donationAvailable += amount;
      else donationClearing += amount;
    }

    const holdings = await sr.entities.HoldingLedgerEntry.filter({
      campaign_id: campaignId,
      beneficiary_user_id: campaign.created_by_id,
      source_type: 'external_platform',
      direction: 'in',
      state: 'settled',
    }, '-created_date', 5000).catch(() => []);
    if (holdings.length >= 5000) {
      return Response.json({ error: 'Campaign settlement history is too large for a safe single balance calculation.' }, { status: 409 });
    }

    let externalAvailable = 0;
    let externalWithdrawn = 0;
    for (const entry of holdings) {
      const amount = Number(entry.amount || 0);
      if (!(amount > 0)) continue;
      if (entry.withdrawal_id) externalWithdrawn += amount;
      else externalAvailable += amount;
    }

    return Response.json({
      ok: true,
      campaign_id: campaignId,
      currency: 'USD',
      available: round2(donationAvailable + externalAvailable),
      in_clearing: round2(donationClearing),
      withdrawn: round2(donationWithdrawn + externalWithdrawn),
      ifund_donations_available: round2(donationAvailable),
      external_settled_available: round2(externalAvailable),
      external_settled_withdrawn: round2(externalWithdrawn),
      clearing_days: CLEARING_DAYS,
    });
  } catch (error) {
    console.error('getCampaignWithdrawalBalance failed:', error?.name || 'UnknownError');
    return Response.json({ error: 'Withdrawal balance could not be calculated safely.' }, { status: 500 });
  }
}
