import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { generateAndDistribute } from '../../shared/crossPost.ts';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { emitActivityEvent } from '../../shared/activityEvent.ts';

// Campaign update cross-posting + follower notifications.
// When an owner publishes an update, this function:
//   1. stores the CampaignUpdate,
//   2. uses the shared cross-posting engine to generate platform-specific
//      versions and distribute them (auto-publish requires outreach+
//      subscription + AI OBO consent; otherwise saves as drafts),
//   3. notifies every follower who opted in to update notifications.
// The owner stays in control — auto-publish only happens with an active
// subscription, consent, and real credentials.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;

    const { campaign_id, title, content, media_url, media_type, cross_post } = await req.json();
    if (!content || !content.trim()) return Response.json({ error: 'Update content is required.' }, { status: 400 });

    const campaign = await base44.entities.Campaign.get(campaign_id).catch(() => null);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.created_by_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the campaign owner can post updates.' }, { status: 403 });
    }
    if (cross_post !== false && campaign.created_by_id !== user.id) {
      return Response.json({ error: 'Only the campaign owner can authorize AI preparation or cross-platform publishing.' }, { status: 403 });
    }

    // 1. Store the update
    const update = await base44.entities.CampaignUpdate.create({
      campaign_id,
      title: title || undefined,
      content,
      media_url: media_url || undefined,
      media_type: media_type || (media_url ? 'image' : 'none'),
    });

    // 2. Cross-post to social connections (unless the owner opted out for this post)
    let crosspost = { generated: 0, published: 0, pending: 0, drafts: 0, failed: 0, skipped: 0, authorization_blocked: '' };
    if (cross_post !== false) {
      const sr = base44.asServiceRole;
      const connections = user.role === 'admin' && campaign.created_by_id !== user.id
        ? await sr.entities.PlatformConnection.filter({ created_by_id: campaign.created_by_id })
        : await base44.entities.PlatformConnection.filter({});
      const consentOwner = campaign.created_by_id === user.id
        ? user
        : await sr.entities.User.get(campaign.created_by_id).catch(() => null);
      const url = `${new URL(req.url).origin}/campaign/${campaign_id}`;
      const prompt = `You are the AI Campaign Distribution Engine for Interplanetary Fund.
A campaign owner just published an update. Write one platform-tailored post per platform announcing this update. Do NOT reuse identical text — adapt tone, length, and format per platform rules. Every post must include the campaign link ${url}.

Campaign: ${campaign.title}
${campaign.summary ? `Summary: ${campaign.summary}` : ''}
Update title: ${title || '(none)'}
Update content: ${content}`;

      crosspost = await generateAndDistribute({
        base44, sr, user: consentOwner || user, campaign, connections, prompt, sourceUpdateId: update.id,
        // The campaign owner explicitly checked Cross-post and clicked Post update.
        // That click is authorization for this publication event; standing OBO
        // consent is only required for background/automatic publishing later.
        explicitPublish: true,
      });
    }

    // 3. Notify followers who opted in to updates (service role — reads all follows)
    const sr = base44.asServiceRole;
    const followers = await sr.entities.FollowedCampaign.filter({ campaign_id, archived: false });
    let notified = 0;
    const body = title || content.slice(0, 120);
    for (const f of followers) {
      if (f.notification_prefs && f.notification_prefs.updates === false) continue;
      await sr.entities.Notification.create({
        user_id: f.user_id,
        title: `New update from ${campaign.title}`,
        body,
        type: 'update',
        link: `/campaign/${campaign_id}`,
      });
      notified++;
    }

    await emitActivityEvent(base44, {
      type: 'campaign_update',
      actor_user_id: user.id,
      actor_display_name: user.full_name || 'Campaign owner',
      campaign_id,
      campaign_title: campaign.title,
      campaign_image_url: campaign.cover_image_url || undefined,
      body: title || content.slice(0, 140),
      link: `/campaign/${campaign_id}`,
      visibility: 'public',
      metadata: { update_id: update.id },
    });

    return Response.json({ update, crosspost, followers_notified: notified });
  } catch (error) {
    console.error('postCampaignUpdate error:', error?.name || 'UnknownError');
    return Response.json({ error: 'Unable to publish your update. Please try again.' }, { status: 500 });
  }
}