import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

const WIX_COLLECTION = 'IFundCampaigns';
const WIX_SAVE_URL = 'https://www.wixapis.com/wix-data/v2/items/save';

function wixItem(c: any) {
  return {
    id: String(c.id),
    data: {
      ifundCampaignId: String(c.id),
      title: String(c.title || ''),
      summary: String(c.summary || ''),
      story: String(c.story || ''),
      category: String(c.category || ''),
      goalAmount: Number(c.goal_amount || 0),
      raisedAmount: Number(c.raised_amount || 0),
      donorCount: Number(c.donor_count || 0),
      status: String(c.status || ''),
      coverImageUrl: String(c.cover_image_url || ''),
      endDate: String(c.end_date || ''),
      syncedAt: new Date().toISOString(),
    },
  };
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const admin = user.role === 'admin' || user.role === 'super_admin';

    const campaigns = body?.campaign_id
      ? await base44.entities.Campaign.filter({ id: String(body.campaign_id), ...(admin ? {} : { created_by_id: user.id }) })
      : await base44.entities.Campaign.filter(admin ? {} : { created_by_id: user.id });

    const conn = await base44.asServiceRole.connectors.getConnection('wix');
    if (!conn?.accessToken) return Response.json({ error: 'Wix is not connected.' }, { status: 409 });

    const results = [];
    for (const campaign of campaigns) {
      const res = await fetch(WIX_SAVE_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${conn.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataCollectionId: WIX_COLLECTION, dataItem: wixItem(campaign) }),
      });
      if (!res.ok) {
        results.push({ campaign_id: campaign.id, ok: false, status: res.status });
        continue;
      }
      const saved = await res.json().catch(() => ({}));
      results.push({ campaign_id: campaign.id, ok: true, action: saved?.action || 'saved' });
    }
    return Response.json({ ok: results.every((r) => r.ok), synced: results.filter((r) => r.ok).length, results });
  } catch (error) {
    console.error('syncWixCampaigns error:', error?.message || error);
    return Response.json({ error: 'Campaigns could not be synchronized to Wix.' }, { status: 500 });
  }
}