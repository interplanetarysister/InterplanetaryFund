import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Campaign Protocol enforcement — invoked by the "Campaign Protocol" entity
// workflow whenever a Campaign is created or updated. It:
//   1. forces outreach_enabled = true (Michelle's directive: all campaigns),
//   2. reverts any campaign launched as "active" that is missing required
//      fields back to "draft" so incomplete campaigns can never go live,
//   3. leaves optional AI preferences and supporter ideas optional,
//   4. opens a single follow-up Recommendation for any incomplete campaign.
// Idempotent + deduped so the entity trigger can't loop.
const ACTIVE_REQUIRED = ['title', 'category', 'cover_image_url'];
const FLAG_TITLE = 'Campaign Protocol — action needed';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const campaign_id = body?.campaign_id || body?.id;
    if (!campaign_id) return Response.json({ error: 'campaign_id is required' }, { status: 400 });

    const c = await sr.entities.Campaign.get(campaign_id).catch(() => null);
    if (!c) return Response.json({ error: 'Campaign not found' }, { status: 404 });

    // Private drafts may be saved at any stage: no artificial AI profile,
    // outreach, publishing or completion requirements until launch.
    if (c.status === 'draft') {
      return Response.json({ ok: true, updated: [], issues: [] });
    }

    const updates = {};
    const issues = [];

    // 1. outreach default on
    if (!c.outreach_enabled) updates.outreach_enabled = true;

    // 2. active-status gate
    if (c.status === 'active') {
      const missing = ACTIVE_REQUIRED.filter((f) => {
        const v = c[f];
        return v == null || (typeof v === 'string' && v.trim() === '');
      });
      if (!(c.goal_amount > 0) && !missing.includes('goal_amount')) missing.push('goal_amount');
      if (!String(c.story || c.summary || '').trim()) missing.push('campaign story');
      if (missing.length) {
        updates.status = 'draft';
        issues.push(`Reverted to draft — missing required fields for active status: ${missing.join(', ')}.`);
      }
    }

    // 3. AI profile questions are optional. Do not ask creators to repeat
    // supporter guesses or require them to provide research for the agents.

    if (Object.keys(updates).length) {
      await sr.entities.Campaign.update(campaign_id, updates);
    }

    // 4. one deduped follow-up recommendation
    if (issues.length) {
      const existing = await sr.entities.Recommendation.filter({
        campaign_id,
        title: FLAG_TITLE,
        status: 'open',
      }).catch(() => []);
      if (!existing.length) {
        await sr.entities.Recommendation.create({
          campaign_id,
          campaign_title: c.title || 'Untitled campaign',
          owner_user_id: c.created_by_id,
          title: FLAG_TITLE,
          description: issues.join('\n'),
          reasoning: "Campaigns need a title, category, picture, goal, and story before going live. AI preferences and supporter ideas are optional.",
          agent: 'strategy',
          status: 'open',
          confidence: 'high',
          expected_impact: 'Campaign becomes compliant and ready to attract donors.',
          estimated_effort: 'A few minutes',
        }).catch(() => {});
      }
    }

    return Response.json({ ok: true, updated: Object.keys(updates), issues });
  } catch (error) {
    console.error('enforceCampaignProtocol error:', error.message);
    return Response.json({ error: 'Unable to enforce the campaign protocol.' }, { status: 500 });
  }
}