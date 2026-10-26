// Shared cross-posting engine: generates platform-tailored posts via LLM and
// distributes them to every connected social + fundraising platform for a
// campaign. Used by both campaign-launch announcements and campaign updates.
//
// Authorization model (all must be true for auto-publish):
//   1. Active subscription at outreach+ level (level >= 2)
//   2. AI OBO consent granted (user authorized the platform to post on their behalf)
//   3. Platform access for social_publish is enabled
//   4. Connection automation_mode is 'auto' and the platform supports direct publishing
//
// Without a subscription, posts are still generated but saved as drafts so the
// user can review and post manually — the user is never blocked from creating
// content, only from automated publishing.

import { hasSubscriptionLevel } from './subscriptionEntitlements.ts';
import { canAutoPublish, canPublishViaConnector, hasAiPublishingConsent, publishThroughConnection } from './socialPublish.ts';
import { assertExternalAgentAction, assertPlatformAccess } from './integrationRegistry.ts';
import { resolveCapabilityForPlatform } from './providerCapabilities.ts';
import { resolveDonationDestination } from './distributionDestination.js';

const COMPLIANCE = `Compliance (non-negotiable): never fabricate facts, amounts, names, or urgency; use only the provided campaign context; no spam; no false promises.`;

// Filters a user's connections to those eligible for cross-posting for a given
// campaign: same owner, campaign-scoped or global, not manual mode.
export function eligibleConnections(connections, campaign, includeManual = false) {
  return (connections || []).filter((c) =>
    c.status === 'connected' &&
    c.verification_status === 'verified' &&
    (includeManual || c.automation_mode !== 'manual') &&
    c.created_by_id === campaign.created_by_id &&
    (!c.campaign_id || c.campaign_id === campaign.id)
  );
}

// Determines whether the user is authorized for auto-publishing (subscription +
// consent + platform access). Returns the reason auto-publish is blocked, or
// null if it is allowed.
export async function autoPublishAuthorization(sr, user, campaign) {
  const subscription = hasSubscriptionLevel(user, 2);
  const consent = hasAiPublishingConsent(user);
  if (!subscription) return 'An active outreach subscription is required to auto-publish to all connected platforms.';
  if (!consent) return 'AI OBO authorization is not active.';
  const access = await assertPlatformAccess(sr, 'social_publish');
  if (!access.ok) return `Social publishing is currently disabled: ${access.reason}`;
  return null;
}

// Generates platform-tailored posts via the LLM and distributes them.
// Returns { generated, published, pending, drafts, failed, skipped, authorization_blocked }.
export async function generateAndDistribute(opts) {
  const {
    base44, sr, user, campaign, connections, prompt, sourceUpdateId, explicitPublish = false,
  } = opts;

  const result = { generated: 0, published: 0, pending: 0, drafts: 0, failed: 0, skipped: 0, authorization_blocked: '' };

  const targets = eligibleConnections(connections, campaign, explicitPublish);
  const blockedReason = explicitPublish ? null : await autoPublishAuthorization(sr, user, campaign);
  const canAuto = explicitPublish || !blockedReason;
  result.authorization_blocked = blockedReason || '';

  if (!targets.length) return result;

  let donationDestination;
  try {
    donationDestination = await resolveDonationDestination(sr, campaign.created_by_id, campaign.id, campaign.distribution_donation_connection_id || '');
  } catch (_) {
    result.authorization_blocked = 'Your saved external fundraiser link needs reconnection before IFund can prepare more promotional posts.';
    return result;
  }

  const fullPrompt = `${prompt}

${COMPLIANCE}

Platform rules:
${targets.map((c) => `- ${c.platform}: ${PLATFORM_RULES[c.platform] || 'General social post, under 400 chars.'}`).join('\n')}

Campaign: ${campaign.title}
${campaign.summary ? `Summary: ${campaign.summary}` : ''}
The owner-selected donation page is ${donationDestination.url}. Do not insert alternative donation links or imply funds from an external provider are held by IFund.

Return JSON only.`;

  let posts: any[] = [];
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: fullPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          posts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                platform: { type: 'string' },
                content: { type: 'string' },
                hashtags: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
    });
    posts = res.posts || [];
  } catch {
    // LLM failure is non-fatal — we just don't generate posts.
    return result;
  }

  for (const post of posts) {
    const conn = targets.find((c) => c.platform === post.platform);
    if (!conn || !post.content) continue;
    if (sourceUpdateId) {
      const prior = await sr.entities.DistributedPost.filter({
        campaign_id: campaign.id,
        connection_id: conn.id,
        source_update_id: sourceUpdateId,
      }).catch(() => []);
      if (prior?.length) {
        result.skipped++;
        continue;
      }
    }
    result.generated++;

    // AI-proposed links are never trusted as fundraiser checkout destinations.
    const copyWithoutUrls = String(post.content).replace(/https?:\/\/[^\s]+/gi, '').trim();
    const room = Math.max(0, (conn.platform === 'bluesky' ? 300 : 3000) - donationDestination.url.length - 2);
    const approvedContent = `${copyWithoutUrls.slice(0, room).trim()}\n${donationDestination.url}`.trim();
    const text = [approvedContent, ...(post.hashtags || [])].join(' ').trim();

    // Auto-publish only when subscription + consent + platform access + auto mode,
    // a runtime adapter exists, and the canonical provider registry confirms an
    // implemented, passing, directly verified publish path.
    const capability = await resolveCapabilityForPlatform(sr, conn.platform);
    const directPublishVerified = capability?.direct_publish_verified === true && capability?.test_status === 'passing' && capability?.implementation_status === 'implemented';
    const shouldAutoPublish = canAuto &&
      (explicitPublish || conn.automation_mode === 'auto') &&
      directPublishVerified &&
      (canAutoPublish(conn) || canPublishViaConnector(conn.platform));

    if (shouldAutoPublish) {
      const obo = explicitPublish ? { ok: true } : await assertExternalAgentAction(sr, {
        ownerUser: user,
        ownerUserId: campaign.created_by_id,
        campaign,
        connection: conn,
        capability: 'create_post',
        requireAutomation: true,
      });
      if (obo.ok) {
        try {
          const { url: postUrl } = await publishThroughConnection(conn, text, sr);
          await base44.entities.DistributedPost.create({
            campaign_id: campaign.id,
            campaign_title: campaign.title,
            connection_id: conn.id,
            platform: conn.platform,
            source_update_id: sourceUpdateId || undefined,
            content: approvedContent,
            hashtags: post.hashtags || [],
            donation_destination_url: donationDestination.url,
            donation_destination_platform: donationDestination.platform,
            status: 'published',
            published_at: new Date().toISOString(),
            external_post_url: postUrl,
          });
          await base44.entities.PlatformConnection.update(conn.id, {
            status: 'connected',
            verification_status: 'verified',
            last_synced: new Date().toISOString(),
            last_error: '',
          });
          result.published++;
          continue;
        } catch {
          await base44.entities.DistributedPost.create({
            campaign_id: campaign.id,
            campaign_title: campaign.title,
            connection_id: conn.id,
            platform: conn.platform,
            source_update_id: sourceUpdateId || undefined,
            content: approvedContent,
            hashtags: post.hashtags || [],
            donation_destination_url: donationDestination.url,
            donation_destination_platform: donationDestination.platform,
            status: 'failed',
            error: 'Publishing failed.',
            retry_count: 1,
          });
          result.failed++;
          continue;
        }
      }
    }

    // No auto-publish (no subscription, manual mode, or platform doesn't support
    // direct posting) — save as draft or pending_approval so the user can
    // review and post manually.
    await base44.entities.DistributedPost.create({
      campaign_id: campaign.id,
      campaign_title: campaign.title,
      connection_id: conn.id,
      platform: conn.platform,
      source_update_id: sourceUpdateId || undefined,
      content: approvedContent,
      hashtags: post.hashtags || [],
      donation_destination_url: donationDestination.url,
      donation_destination_platform: donationDestination.platform,
      status: explicitPublish ? 'approved' : conn.automation_mode === 'draft' ? 'draft' : 'pending_approval',
    });
    if (!explicitPublish && conn.automation_mode === 'draft') result.drafts++;
    else result.pending++;
  }

  result.skipped = connections.length - targets.length;
  return result;
}

export const PLATFORM_RULES = {
  facebook: 'Facebook: warm post, 2-3 short paragraphs, up to 400 words, 2-3 hashtags.',
  instagram: 'Instagram: emotive caption, emoji-friendly, under 2200 chars, 8-12 hashtags.',
  threads: 'Threads: conversational, under 500 chars, 1-3 hashtags.',
  x: 'X: punchy, under 260 chars including link, 1-2 hashtags.',
  linkedin: 'LinkedIn: professional impact, 2-3 paragraphs, 3-5 hashtags.',
  tiktok: 'TikTok: caption + hook, casual, under 150 chars, 3-5 hashtags.',
  pinterest: 'Pinterest: descriptive pin, aspirational, 2-4 hashtags.',
  reddit: 'Reddit: honest, no marketing tone, no hashtags.',
  youtube: 'YouTube Community: friendly, 1-2 paragraphs, no hashtags.',
  discord: 'Discord: community announcement, short, emoji ok, no hashtags.',
  bluesky: 'Bluesky: under 280 chars, authentic, 1-2 hashtags.',
  mastodon: 'Mastodon: under 480 chars, genuine, 2-3 hashtags.',
  gofundme: 'GoFundMe: heartfelt, 1-3 paragraphs, thank supporters, no hashtags.',
  kickstarter: 'Kickstarter: backer-focused, milestone-driven, 2-3 paragraphs, no hashtags.',
  indiegogo: 'Indiegogo: backer/perk-focused, progress and gratitude, 2-3 paragraphs.',
  fundrazr: 'FundRazr: community-focused, concise, gratitude and progress.',
  givesendgo: 'GiveSendGo: faith-friendly, gratitude and progress.',
  spotfund: 'Spotfund: brief, thank supporters, progress.',
  kofi: 'Ko-fi: casual, thank supporters, share progress.',
  buymeacoffee: 'Buy Me a Coffee: casual, gratitude and progress.',
  patreon: 'Patreon: patron update, behind-the-scenes, gratitude, 2-3 paragraphs.',
  custom: 'Custom site: general campaign post, gratitude and progress.',
};