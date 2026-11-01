import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

// Shared, owner-scoped account visibility for all IFund agents. Never return
// credentials, connector tokens, sessions, private admin integrations or raw finance.
const clip = (value: unknown, n = 300) => String(value ?? '').slice(0, n);
const pick = (obj: any, fields: string[]) => Object.fromEntries(fields.map(k => [k, obj?.[k]]));
export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;
    const sr = base44.asServiceRole;
    const unavailableSources:string[] = [];
    const list = async (query:Promise<any>, source:string) => {
      try { const result = await query; if(!Array.isArray(result))throw new Error('Unexpected result'); return result; }
      catch { unavailableSources.push(source); return []; }
    };
    const [connections, campaigns, profiles, followed, posts, distributedByOwner, distributedByCreator, membership, delegations, drafts, interests] = await Promise.all([
      list(sr.entities.PlatformConnection.filter({ created_by_id: user.id }, '-updated_date', 120),'connections'),
      list(sr.entities.Campaign.filter({ created_by_id: user.id }, '-updated_date', 100),'campaigns'),
      list(sr.entities.PublicProfile.filter({ user_id: user.id }),'profile'),
      list(sr.entities.FollowedCampaign.filter({ user_id: user.id }, '-created_date', 100),'followed_campaigns'),
      list(sr.entities.SocialPost.filter({ author_user_id: user.id }, '-created_date', 60),'ifund_posts'),
      list(sr.entities.DistributedPost.filter({ owner_user_id: user.id }, '-created_date', 100),'external_posts_owner'),
      list(sr.entities.DistributedPost.filter({ created_by_id: user.id }, '-created_date', 100),'external_posts_creator'),
      list(sr.entities.CommunityMember.filter({ user_id: user.id }, '-created_date', 100),'community_memberships'),
      list(sr.entities.AgentDelegation.filter({ owner_user_id: user.id }, '-updated_date', 80),'agent_work'),
      list(sr.entities.AgentContentDraft.filter({ owner_user_id: user.id }, '-created_date', 30),'content_drafts'),
      list(sr.entities.PostInterest.filter({ user_id: user.id }, '-updated_at', 100),'liked_and_saved_posts'),
    ]);
    const distributed = [...new Map([...distributedByOwner, ...distributedByCreator]
      .filter((p:any) => p.owner_user_id === user.id || p.created_by_id === user.id)
      .map((p:any) => [p.id, p])).values()];
    const personalInterests = interests.filter((i:any) => i.user_id === user.id && (i.liked === true || i.saved === true));
    const interestPosts = await Promise.all(personalInterests.slice(0,30).map(async (i:any) => {
      const post = await sr.entities.SocialPost.get(i.post_id).catch(() => null);
      return post ? {
        post_id: i.post_id, liked: i.liked === true, saved: i.saved === true,
        author_user_id: post.author_user_id, campaign_id: post.campaign_id,
        content_preview: clip(post.content, 180),
      } : null;
    }));
    return Response.json({
      ok: true,
      data_complete: unavailableSources.length === 0,
      data_unavailable_sources: unavailableSources,
      owner_user_id: user.id,
      connections: connections.filter((c:any) => c.created_by_id === user.id).map((c:any) => ({
        id: c.id, platform: c.platform, kind: c.kind, display_name: clip(c.display_name, 120),
        external_url: clip(c.external_url, 500), campaign_id: c.campaign_id,
        status: c.status, verification_status: c.verification_status,
        capability_status: c.capability_status, automation_mode: c.automation_mode,
        agent_access: pick(c.agent_access, ['shared_with_agents','automation_enabled']),
        obo_consent: pick(c.obo_consent, ['granted','opted_out','requested_capabilities','granted_capabilities','provider_capabilities','permission_version']),
        last_synced: c.last_synced, needs_attention: !!c.last_error,
      })),
      campaigns: campaigns.filter((c:any) => c.created_by_id === user.id).map((c:any) => pick(c,
        ['id','title','summary','category','goal_amount','raised_amount','donor_count','status','outreach_enabled','outreach_paused','ai_profile'])),
      profile: profiles.find((p:any) => p.user_id === user.id)
        ? pick(profiles.find((p:any) => p.user_id === user.id), ['display_name','username','bio','focus_campaign_ids','priority_campaign_id','show_posts','show_communities'])
        : null,
      followed_campaigns: followed.filter((f:any) => f.user_id === user.id).map((f:any) =>
        pick(f, ['campaign_id','campaign_title','category','pinned','archived','notification_prefs'])),
      ifund_posts: posts.filter((p:any) => p.author_user_id === user.id).map((p:any) => ({
        ...pick(p, ['id','campaign_id','likes_count','comments_count','reposts_count','external_url','source_platform','crosspost_platforms','created_date']),
        content_preview: clip(p.content, 280),
      })),
      external_posts: distributed.filter((p:any) => p.owner_user_id === user.id || p.created_by_id === user.id).map((p:any) => ({
        ...pick(p, ['id','campaign_id','connection_id','platform','status','scheduled_for','published_at','external_post_url','error']),
        content_preview: clip(p.content, 240),
      })),
      community_memberships: membership.filter((m:any) => m.user_id === user.id).map((m:any) => pick(m, ['community_id','role'])),
      liked_and_saved_posts: interestPosts.filter(Boolean),
      agent_work: delegations.filter((d:any) => d.owner_user_id === user.id).map((d:any) =>
        pick(d, ['id','campaign_id','source_agent','destination_agent','objective','status','result_summary','updated_at'])),
      content_drafts: drafts.filter((d:any) => d.owner_user_id === user.id).map((d:any) =>
        pick(d, ['id','kind','campaign_id','connection_id','status','source_agent','updated_at'])),
      limitations: {
        liked_or_saved_post_history: 'History is recorded for new user interactions; earlier anonymous or untracked likes cannot be attributed retroactively.',
        provider_receipts: 'An external post is confirmed only by published status and a provider-backed receipt/URL.',
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('getAgentAccountContext:', error instanceof Error ? error.name : 'Error');
    return Response.json({ error: 'Account context could not be loaded.' }, { status: 500 });
  }
}
