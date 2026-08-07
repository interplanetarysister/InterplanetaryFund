import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const { campaign_id, campaign_title } = body;
    if (!campaign_id) return Response.json({ error: 'Missing campaign_id' }, { status: 400 });

    const existing = await base44.asServiceRole.entities.Follow.filter({ follower_id: user.id, campaign_id });
    if (existing.length > 0) {
      await base44.asServiceRole.entities.Follow.delete(existing[0].id);
      const all = await base44.asServiceRole.entities.Follow.filter({ campaign_id });
      return Response.json({ following: false, count: all.length });
    }
    await base44.asServiceRole.entities.Follow.create({
      follower_id: user.id,
      follower_name: user.full_name || user.email || 'Supporter',
      campaign_id,
      campaign_title: campaign_title || '',
    });
    const all = await base44.asServiceRole.entities.Follow.filter({ campaign_id });
    return Response.json({ following: true, count: all.length });
  } catch (error) {
    console.error('manageFollow error', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}