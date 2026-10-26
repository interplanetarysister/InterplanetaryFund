import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { giftOf, round2 } from '../../shared/fees.js';

const MAX_CAMPAIGNS = 500;
const MAX_DONATIONS_PER_CAMPAIGN = 2000;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sr = base44.asServiceRole;
    const campaigns = await base44.entities.Campaign.filter({ created_by_id: user.id }, '-created_date', MAX_CAMPAIGNS).catch(() => []);
    if (!Array.isArray(campaigns)) return Response.json({ error: 'Could not load campaigns.' }, { status: 500 });
    if (campaigns.length >= MAX_CAMPAIGNS) {
      return Response.json({ error: 'Campaign history is too large for a safe single donor-directory request.' }, { status: 409 });
    }

    const known = new Map();
    const anonymous = [];
    let verifiedDonationCount = 0;

    for (const campaign of campaigns) {
      const donations = await sr.entities.Donation.filter({ campaign_id: campaign.id }, '-created_date', MAX_DONATIONS_PER_CAMPAIGN).catch(() => []);
      if (!Array.isArray(donations)) continue;
      if (donations.length >= MAX_DONATIONS_PER_CAMPAIGN) {
        return Response.json({ error: 'Donation history is too large for a safe single donor-directory request.' }, { status: 409 });
      }

      for (const donation of donations) {
        if (donation.payment_verified !== true) continue;
        const gift = round2(giftOf(donation));
        if (!(gift > 0)) continue;
        verifiedDonationCount += 1;
        const at = String(donation.created_date || '');
        const recurring = donation.is_recurring === true && donation.recurring_status !== 'cancelled';
        const name = String(donation.donor_name || '').trim();
        const donorUserId = String(donation.donor_user_id || '').trim();

        if (!donorUserId) {
          anonymous.push({
            donor_ref: `anonymous-${campaign.id}-${donation.id}`,
            display_name: name || 'Anonymous supporter',
            total_given: gift,
            gift_count: 1,
            recurring,
            last_gift_at: at,
            campaigns: [{ id: campaign.id, title: campaign.title || 'Campaign', total_given: gift, gift_count: 1 }],
            contactable: false,
          });
          continue;
        }

        const key = donorUserId;
        const current = known.get(key) || {
          display_name: name || 'Supporter',
          total_given: 0,
          gift_count: 0,
          recurring: false,
          last_gift_at: '',
          campaigns: new Map(),
          contactable: true,
        };
        current.total_given = round2(current.total_given + gift);
        current.gift_count += 1;
        current.recurring = current.recurring || recurring;
        if (!current.last_gift_at || (at && at > current.last_gift_at)) current.last_gift_at = at;
        const campaignCurrent = current.campaigns.get(campaign.id) || { id: campaign.id, title: campaign.title || 'Campaign', total_given: 0, gift_count: 0 };
        campaignCurrent.total_given = round2(campaignCurrent.total_given + gift);
        campaignCurrent.gift_count += 1;
        current.campaigns.set(campaign.id, campaignCurrent);
        known.set(key, current);
      }
    }

    let refCounter = 0;
    const identifiedRows = [...known.values()].map((entry) => ({
      donor_ref: `supporter-${++refCounter}`,
      display_name: entry.display_name,
      total_given: round2(entry.total_given),
      gift_count: entry.gift_count,
      recurring: entry.recurring,
      last_gift_at: entry.last_gift_at,
      campaigns: [...entry.campaigns.values()].sort((a, b) => b.total_given - a.total_given),
      contactable: entry.contactable,
    }));

    const donors = [...identifiedRows, ...anonymous]
      .sort((a, b) => (b.total_given - a.total_given) || String(b.last_gift_at || '').localeCompare(String(a.last_gift_at || '')));

    return Response.json({
      ok: true,
      donors,
      summary: {
        supporter_rows: donors.length,
        identified_supporters: identifiedRows.length,
        anonymous_gifts: anonymous.length,
        verified_gifts: verifiedDonationCount,
        verified_total: round2(donors.reduce((sum, row) => sum + Number(row.total_given || 0), 0)),
      },
    });
  } catch (error) {
    console.error('getOwnerDonorDirectory failed:', error?.name || 'UnknownError');
    return Response.json({ error: 'Could not load your supporter directory.' }, { status: 500 });
  }
}
