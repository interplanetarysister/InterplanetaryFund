import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const dismissed = body.dismissed || [];

    const [campaigns, follows, donations] = await Promise.all([
      base44.asServiceRole.entities.Campaign.list('-created_date', 200),
      base44.asServiceRole.entities.Follow.filter({ follower_id: user.id }),
      base44.asServiceRole.entities.Donation.list('-created_date', 200),
    ]);

    const donorCountMap = {};
    donations.forEach((d) => { donorCountMap[d.campaign_id] = (donorCountMap[d.campaign_id] || 0) + 1; });

    const userName = user.full_name || user.email;
    const myDonations = donations.filter((d) => d.donor_name === userName);
    const interacted = new Set([...follows.map((f) => f.campaign_id), ...myDonations.map((d) => d.campaign_id)]);
    const categories = new Set();
    campaigns.forEach((c) => { if (interacted.has(c.id)) categories.add(c.category); });

    const withCount = (c, reason) => ({ ...c, donor_count: donorCountMap[c.id] || 0, reason });
    const trending = campaigns.filter((c) => c.status === 'active').sort((a, b) => (b.raised || 0) - (a.raised || 0));

    let recs;
    if (categories.size > 0) {
      recs = campaigns.filter((c) => c.status === 'active' && categories.has(c.category) && !interacted.has(c.id) && !dismissed.includes(c.id))
        .sort((a, b) => (b.raised || 0) - (a.raised || 0))
        .map((c) => withCount(c, `Matches your interest in ${(c.category || '').replace('-', ' ')}`));
      const fill = trending.filter((c) => !recs.find((r) => r.id === c.id) && !dismissed.includes(c.id)).map((c) => withCount(c, 'Trending now'));
      recs = [...recs, ...fill];
    } else {
      recs = trending.filter((c) => !dismissed.includes(c.id)).map((c) => withCount(c, 'Trending now'));
    }

    return Response.json({ recommendations: recs.slice(0, 5) });
  } catch (error) {
    console.error('getRecommendations error', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}