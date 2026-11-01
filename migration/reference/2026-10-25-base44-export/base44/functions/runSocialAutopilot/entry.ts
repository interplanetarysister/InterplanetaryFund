import { isFeatureEnabled } from '../../shared/featureFlagGate.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { canAutoPublish, hasAiPublishingConsent } from '../../shared/socialPublish.ts';
import { assertExternalAgentAction, assertPlatformAccess } from '../../shared/integrationRegistry.ts';
import { resolveCapabilityForPlatform } from '../../shared/providerCapabilities.ts';
import { canEnterMemberQueue, paidPriorityAt } from '../../shared/socialPublishingPolicy.ts';
import { readEntityPages } from '../../shared/readEntityPages.ts';
import { resolveDonationDestination } from '../../shared/distributionDestination.js';

const MAX_CAMPAIGNS = 6;
const DAY = 24 * 60 * 60 * 1000;
function recent(value: unknown, ms: number) {
  const t = Date.parse(String(value || ''));
  return Number.isFinite(t) && Date.now() - t >= 0 && Date.now() - t < ms;
}
function context(c: any) {
  const p = c.ai_profile || {};
  return [
    c.title && `Campaign: ${c.title}`,
    c.summary && `Summary: ${String(c.summary).slice(0,1000)}`,
    c.category && `Type: ${c.category}`,
    p.tone && `Chosen writing style: ${p.tone}`,
    p.donor_discovery_notes && `Creator's voluntary audience notes: ${p.donor_discovery_notes}`,
    p.priority && `Priority: ${p.priority}`,
    p.avoid_words && `Words to avoid: ${p.avoid_words}`,
  ].filter(Boolean).join('\n').slice(0,3000);
}

// Runs daily; only creates trusted queue permits. The hourly sync worker
// enforces no more than one paid-campaign post per external platform in a
// rolling 12-hour window across ALL IFund subscribed campaigns.
export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    if (!(await isFeatureEnabled(base44, 'social_autopilot')))
      return Response.json({ skipped: true, reason: 'Autopilot disabled' });
    const sr = base44.asServiceRole;
    const access = await assertPlatformAccess(sr, 'social_publish');
    if (!access.ok) return Response.json({ skipped: true, reason: 'Publishing access unavailable' });
    const [connectionBatch, campaignBatch, studies] = await Promise.all([
      readEntityPages(sr, 'PlatformConnection', { kind: 'social', status: 'connected' }, 'created_date'),
      readEntityPages(sr, 'Campaign', { status: 'active', outreach_enabled: true }, 'created_date'),
      sr.entities.WritingResearchBrief.filter({ status: 'verified_sources' }, '-created_date', 1).catch(() => []),
    ]);
    const connections = connectionBatch.rows;
    const campaigns = campaignBatch.rows;
    const tips = (studies?.[0]?.guidance || []).slice(0, 5).join('; ').slice(0, 1500);
    const ownerCache = new Map();
    const eligible = [];
    const report = { campaigns_processed: 0, posts_staged: 0, automatic: 0,
      owner_review: 0, failed: 0,
      scan_truncated: campaignBatch.truncated || connectionBatch.truncated };
    for (const campaign of campaigns || []) {
      if (campaign.outreach_paused ||
          recent(campaign.social_last_generated_at, DAY) ||
          recent(campaign.social_last_generation_attempt_at, 2 * 60 * 60 * 1000)) continue;
      let owner = ownerCache.get(campaign.created_by_id);
      if (!owner) {
        owner = await sr.entities.User.get(campaign.created_by_id).catch(() => null);
        if (owner) ownerCache.set(campaign.created_by_id, owner);
      }
      if (!canEnterMemberQueue(owner, campaign) || !hasAiPublishingConsent(owner)) continue;
      const targets = (connections || []).filter(c =>
        c.created_by_id === owner.id &&
        (!c.campaign_id || c.campaign_id === campaign.id) &&
        c.verification_status === 'verified' &&
        ['auto', 'ask', 'draft'].includes(c.automation_mode));
      if (targets.length) eligible.push({ campaign, owner, targets, priority: paidPriorityAt(owner) });
    }
    // First generation favors original paid subscribers; repeated generations
    // rotate to campaigns not served recently instead of starving new members.
    eligible.sort((a,b) => String(a.campaign.social_last_generated_at || '').localeCompare(
      String(b.campaign.social_last_generated_at || '')) ||
      a.priority.localeCompare(b.priority) || String(a.campaign.id).localeCompare(String(b.campaign.id)));

    for (const { campaign, owner, targets, priority } of eligible) {
      if (report.campaigns_processed >= MAX_CAMPAIGNS) break;
      try {
        const existing = await sr.entities.DistributedPost.filter(
          { campaign_id: campaign.id }, '-created_date', 100);
        const destinations = [];
        const seen = new Set();
        for (const conn of targets) {
          if (seen.has(conn.platform)) continue;
          seen.add(conn.platform);
          if ((existing || []).some(p => p.origin === 'agent_autopilot' &&
              p.platform === conn.platform &&
              ['scheduled','publishing','pending_approval','draft'].includes(p.status))) continue;
          const grant = await assertExternalAgentAction(sr, {
            ownerUser: owner, ownerUserId: owner.id, campaign, connection: conn,
            capability: 'create_post', requireAutomation: conn.automation_mode === 'auto',
          });
          if (!grant.ok) continue;
          const capability = await resolveCapabilityForPlatform(sr, conn.platform);
          const verified = capability?.direct_publish_verified === true &&
            capability?.test_status === 'passing' && capability?.implementation_status === 'implemented';
          destinations.push({ conn, auto: conn.automation_mode === 'auto' &&
            verified && canAutoPublish(conn) });
        }
        if (!destinations.length) continue;
        // A saved external fundraising preference takes precedence over IFund checkout.
        // If it became invalid, fail this campaign rather than silently redirect donors.
        const donationDestination = await resolveDonationDestination(sr, owner.id, campaign.id, campaign.distribution_donation_connection_id || '');
        await sr.entities.Campaign.update(campaign.id, {
          social_last_generation_attempt_at: new Date().toISOString(),
        });
        const answer = await sr.integrations.Core.InvokeLLM({
          prompt: `Write a compelling and truthful social media promotion for a subscribed Interplanetary Fund fundraiser.
Use evidence-based persuasion: audience relevance, concrete benefits, meaningful human stories, credible proof, an inspiring but accurate message and a clear invitation to donate or share. Match the creator's chosen style. Social marketing research guidance (not facts about this campaign): ${tips || 'Clarity, credibility, human agency and authentic social connection matter.'}
Never fabricate donations, urgency, trust rankings, accomplishments, testimonials, or results. Do not shame potential donors or exploit personal vulnerability. Under 280 characters, no hashtags in text.
Campaign data:\n${context(campaign)}
Return JSON with post_text and optional hashtags.`,
          response_json_schema: { type: 'object', properties: {
            post_text: { type: 'string' }, hashtags: { type: 'array', items: { type: 'string' } },
          }},
        });
        const campaignUrl = donationDestination.url;
        const copy = String(answer?.post_text || '').replace(/https?:\/\/[^\s]+/gi, '').trim();
        if (!copy) throw new Error('No generated content');
        if (campaignUrl.length > 275) throw new Error('Selected fundraiser link is too long for a short social post');
        // Every promotion uses the owner's saved donation destination.
        // Preserve the full link within short social platform limits.
        const words = [copy.slice(0, 278 - campaignUrl.length).trim(), campaignUrl].join(' ').trim();
        const hashtags = []; // Preserve the whole donation link within 280 chars.
        for (const { conn, auto } of destinations) {
          // Create as a draft, then issue a service-only, owner/connection
          // bound posting permit BEFORE the status becomes scheduled.
          const post = await sr.entities.DistributedPost.create({
            owner_user_id: owner.id, origin: 'agent_autopilot',
            campaign_id: campaign.id, campaign_title: campaign.title,
            connection_id: conn.id, platform: conn.platform,
            content: words, hashtags, status: 'draft', retry_count: 0,
            donation_destination_url: donationDestination.url,
            donation_destination_platform: donationDestination.platform,
          });
          if (auto) {
            await sr.entities.ScheduledAutoPostPermit.create({
              post_id: post.id, campaign_id: campaign.id,
              owner_user_id: owner.id, connection_id: conn.id,
              platform: conn.platform, priority_at: priority, status: 'queued',
            });
            await sr.entities.DistributedPost.update(post.id, {
              status: 'scheduled', scheduled_for: new Date().toISOString(),
            });
            report.automatic++;
          } else {
            await sr.entities.DistributedPost.update(post.id, {
              status: conn.automation_mode === 'ask' ? 'pending_approval' : 'draft',
            });
            report.owner_review++;
          }
          report.posts_staged++;
        }
        await sr.entities.AgentActivity.create({
          campaign_id: campaign.id, campaign_title: campaign.title, owner_user_id: owner.id,
          category: 'content', action: 'Prepared audience-aware campaign promotion.',
          reason: 'Subscriber opted in to IFund social promotion.',
          result: 'Scheduled only when a provider-supported path is verified; otherwise prepared for manual review.',
          status: 'pending', artifact_type: 'social_post',
        }).catch(() => {});
        await sr.entities.Campaign.update(campaign.id, { social_last_generated_at: new Date().toISOString() });
        report.campaigns_processed++;
      } catch (error) {
        console.error('runSocialAutopilot campaign failed:', error?.name || 'UnknownError');
        report.failed++;
      }
    }
    return Response.json(report);
  } catch (error) {
    console.error('runSocialAutopilot failed:', error?.name || 'UnknownError');
    return Response.json({ error: 'Could not prepare social posts.' }, { status: 500 });
  }
}
