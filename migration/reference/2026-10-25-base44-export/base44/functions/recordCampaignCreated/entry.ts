import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { emitActivityEvent } from '../../shared/activityEvent.ts';
import { ensureCanonicalCampaign } from '../../shared/base44Financial.ts';
import { generateAndDistribute } from '../../shared/crossPost.ts';

// Publishes a campaign into the Community feed, registers its stable application
// identity with the canonical Base44 financial store, and cross-posts a launch
// announcement to every connected social + fundraising platform. Auto-publishing
// requires an active outreach+ subscription; without it, posts are saved as
// drafts for the user to review and post manually.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const sr = base44.asServiceRole;

    let user = null;
    try { user = await base44.auth.me(); } catch (_) { /* not signed in */ }
    if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 });

    const { campaign_id } = await req.json();
    if (!campaign_id) return Response.json({ error: 'Campaign is required' }, { status: 400 });

    const campaign = await sr.entities.Campaign.get(campaign_id).catch(() => null);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.created_by_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the campaign owner can publish this event.' }, { status: 403 });
    }
    if (campaign.status !== 'active') {
      return Response.json({ ok: true, skipped: true });
    }

    // Do not silently publish an active campaign that cannot participate in
    // canonical financial accounting. This upsert never trusts the application
    // for raised/donor totals; Base44 preserves canonical financial values.
    await ensureCanonicalCampaign(sr, campaign);

    const creator = await sr.entities.User.get(campaign.created_by_id).catch(() => null);
    const priorLaunchEvents = await sr.entities.ActivityEvent.filter({ type: 'campaign_created', campaign_id: campaign.id }).catch(() => []);
    if (!priorLaunchEvents?.length) await emitActivityEvent(base44, {
      type: 'campaign_created',
      actor_user_id: campaign.created_by_id,
      actor_display_name: (creator && creator.full_name) || 'An organizer',
      actor_handle: (creator && (creator.username || creator.handle)) || undefined,
      actor_image_url: (creator && (creator.photo_url || creator.profile_image_url)) || undefined,
      campaign_id: campaign.id,
      campaign_title: campaign.title,
      campaign_image_url: campaign.cover_image_url || undefined,
      body: `New campaign: ${campaign.title}`,
      link: `/campaign/${campaign.id}`,
      visibility: 'public',
      metadata: { category: campaign.category, goal_amount: campaign.goal_amount },
    });

    // Cross-post a launch announcement to every connected platform. The shared
    // engine handles subscription gating, AI consent, and auto-publish vs draft.
    let crosspost = { generated: 0, published: 0, pending: 0, drafts: 0, failed: 0, skipped: 0, authorization_blocked: '' };
    try {
      const connections = await sr.entities.PlatformConnection.filter({ created_by_id: campaign.created_by_id });
      const url = `${new URL(req.url).origin}/campaign/${campaign.id}`;
      const prompt = `You are the AI Campaign Distribution Engine for Interplanetary Fund.
A campaign just launched. Write one platform-tailored launch announcement per platform. Do NOT reuse identical text — adapt tone, length, and format per platform rules. Every post must include the campaign link ${url}.

Campaign: ${campaign.title}
${campaign.summary ? `Summary: ${campaign.summary}` : ''}
${campaign.story ? `Story excerpt: ${campaign.story.slice(0, 500)}` : ''}

Generate a launch announcement for each connected platform below.`;
      crosspost = await generateAndDistribute({
        base44, sr, user: creator || user, campaign, connections, prompt,
        sourceUpdateId: `launch:${campaign.id}`,
      });
    } catch (crossPostError) {
      console.error('Campaign launch cross-post failed:', crossPostError?.name || 'CrossPostError');
    }

    // Marketing KPI: campaign creation is the core activation event.
    try { await base44.analytics.track({ eventName: 'campaign_created', properties: { campaign_id: campaign.id, category: campaign.category } }); } catch (_) { /* non-fatal */ }

    return Response.json({ ok: true, canonical_registered: true, crosspost });
  } catch (error) {
    console.error('recordCampaignCreated error:', error?.name || 'UnknownError');
    return Response.json({ error: 'Unable to publish campaign because the canonical backend could not be updated.' }, { status: 503 });
  }
}