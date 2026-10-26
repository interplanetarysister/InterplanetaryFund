import { isFeatureEnabled, featureUnavailable } from '../../shared/featureFlagGate.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { hasAiPublishingConsent } from '../../shared/socialPublish.ts';
import { latestWritingGuidance } from '../../shared/writingGuidance.ts';
import { resolveDonationDestination } from '../../shared/distributionDestination.js';

// AI Campaign Distribution Engine — generates platform-tailored post content
// for each connected social AND crowdfunding destination (never identical
// copies), saved as DistributedPost drafts the owner can approve before
// broadcasting — direct-publish where an API exists, copy-to-post otherwise.

const PLATFORM_RULES = {
  facebook: 'Facebook: warm, story-driven, 2-4 short paragraphs, up to 400 words, 2-3 hashtags at the end.',
  instagram: 'Instagram: emotive caption, short punchy lines, emoji-friendly, under 2200 chars, 8-12 hashtags.',
  threads: 'Threads: conversational, under 500 chars, 1-3 hashtags.',
  x: 'X: punchy, under 260 chars including link placeholder, 1-2 hashtags.',
  linkedin: 'LinkedIn: professional, impact-focused, 2-3 paragraphs, 3-5 hashtags.',
  tiktok: 'TikTok: video caption idea + hook line, casual, under 150 chars, 3-5 hashtags.',
  pinterest: 'Pinterest: descriptive pin title + description, aspirational, 2-4 hashtags.',
  reddit: 'Reddit: honest, no marketing tone, no hashtags, transparent ask with context.',
  youtube: 'YouTube Community: friendly update style, 1-2 paragraphs, no hashtags.',
  discord: 'Discord: community announcement tone, short, emoji ok, no hashtags.',
  bluesky: 'Bluesky: under 280 chars, authentic, 1-2 hashtags.',
  mastodon: 'Mastodon: under 480 chars, genuine and community-minded, 2-3 hashtags.',
  // Crowdfunding destinations — update-style posts the owner copies into the
  // external campaign page (no posting API available).
  gofundme: 'GoFundMe update: heartfelt progress update, 1-3 paragraphs, thank supporters and share progress toward goal, no hashtags.',
  kickstarter: 'Kickstarter update: backer update tone, milestone-focused, 2-3 paragraphs, no hashtags.',
  indiegogo: 'Indiegogo update: backer/perk update, progress and gratitude, 2-3 paragraphs.',
  fundrazr: 'FundRazr update: community update, concise, gratitude and progress, 1-2 paragraphs.',
  givesendgo: 'GiveSendGo update: faith-friendly community update, gratitude and progress, 1-2 paragraphs.',
  spotfund: 'Spotfund update: brief community update, thank supporters, progress toward goal.',
  kofi: 'Ko-fi post: casual community update, thank supporters, share progress, 1-2 short paragraphs.',
  buymeacoffee: 'Buy Me a Coffee post: casual update to supporters, gratitude and progress, 1-2 paragraphs.',
  patreon: 'Patreon post: patron update, behind-the-scenes tone, gratitude, 2-3 paragraphs.',
  custom: 'Custom site update: general campaign update, gratitude and progress, 2-3 paragraphs.',
};

// Keep draft preparation available when an AI provider is unavailable or out of credits.
// This is clearly identified as a template, never represented as AI output.
function templatePosts(campaign, targets) {
  const title = String(campaign.title || 'this campaign').trim();
  const summary = String(campaign.summary || campaign.story || '').replace(/\\s+/g, ' ').trim().slice(0, 360);
  const description = summary || 'Learn about the campaign and why it matters to its creator.';
  const short = description.length > 125 ? description.slice(0, 122).trimEnd() + '…' : description;
  return targets.map((connection) => {
    const platform = String(connection.platform || '').toLowerCase();
    const content = ({
      x: `${title}: ${short}`,
      bluesky: `${title} — ${short}`,
      threads: `Have you heard about ${title}? ${description}`,
      linkedin: `Sharing a fundraising campaign: ${title}.\\n\\n${description}\\n\\nRead the campaign details and consider supporting or sharing.`,
      instagram: `${title}\\n\\n${description}\\n\\nLearn more and share if this speaks to you.`,
      tiktok: `${title} — ${short}`,
      reddit: `Sharing the campaign ${title}. ${description} Please review the details before deciding whether to support.`,
      gofundme: `Update about ${title}: ${description} Thank you for taking the time to learn about this campaign.`,
      kickstarter: `Campaign update — ${title}\\n\\n${description}`,
    })[platform] || `Please take a look at ${title}. ${description} You can read the details and decide whether to share or support.`;
    return { platform: connection.platform, connection_id: connection.id, content, hashtags: [] };
  });
}

// A creator may explicitly choose either IFund checkout or their own linked
// external fundraiser. External payments stay with the external provider.
function generateDonationBlock(url) {
  return `\n\nSupport this campaign: ${url}`;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    if (!(await isFeatureEnabled(base44, 'ai_campaign_assistant'))) return featureUnavailable('AI distribution content');
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;

    const { campaign_id, connection_ids, donation_destination_connection_id = '' } = await req.json();
    if (!campaign_id || !Array.isArray(connection_ids) || !connection_ids.length) {
      return Response.json({ error: 'Pick at least one connected platform.' }, { status: 400 });
    }

    const campaign = await base44.entities.Campaign.get(campaign_id).catch(() => null);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.created_by_id !== user.id) {
      return Response.json({ error: 'Only the campaign owner can distribute it.' }, { status: 403 });
    }
    if (!hasAiPublishingConsent(user)) {
      return Response.json({ error: 'AI preparation and publishing authorization is required.' }, { status: 403 });
    }

    // Fail closed across the complete campaign → connection ownership chain.
    // Unscoped owner connections may serve the owner's campaigns; a connection
    // scoped to another campaign is never eligible.
    const all = await base44.entities.PlatformConnection.filter({});
    const targets = all.filter((c) =>
      connection_ids.includes(c.id) &&
      c.status === 'connected' &&
      c.verification_status === 'verified' &&
      c.created_by_id === campaign.created_by_id &&
      (!c.campaign_id || c.campaign_id === campaign.id)
    );
    if (!targets.length) {
      return Response.json({ error: 'None of the selected accounts are ready for content preparation.' }, { status: 400 });
    }

    let destination;
    try {
      destination = await resolveDonationDestination(base44.asServiceRole, user.id, campaign.id, donation_destination_connection_id);
    } catch (error) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    const p = campaign.ai_profile || {};
    const url = destination.url;
    const research = await latestWritingGuidance(base44.asServiceRole);
    const prompt = `You are the AI Campaign Distribution Engine for Interplanetary Fund.
Compliance (non-negotiable): never fabricate facts, amounts, names, or urgency; use only the campaign context; no spam; no false promises.
Writing and audience psychology reference: ${research || 'Compelling true stories, agency, clarity, credible impact.'}
Use thoughtful persuasive framing and relevant donor motivations appropriate to the creator's requested tone. Never claim facts solely because they appeared in research.

Write one tailored post per platform below. Do NOT reuse the same text — adapt tone, length, and format per platform rules. The creator selected this support destination: ${url} (${destination.kind === 'external' ? 'external provider; that provider handles donations' : 'IFund direct checkout'}). Every public appeal must use this selected link, never substitute an IFund payment link. Fundraising-site updates are drafts for an existing external campaign, NOT proof that IFund created or published a fundraiser.

Platform rules:
${targets.map((c) => `- ${c.platform}: ${PLATFORM_RULES[c.platform] || 'General social post, under 400 chars.'}`).join('\n')}

Campaign context:
Title: ${campaign.title}
Summary: ${campaign.summary || ''}
Goal: $${campaign.goal_amount} | Raised: $${campaign.raised_amount || 0} from ${campaign.donor_count || 0} donors
Story (excerpt): ${(campaign.story || '').slice(0, 1200)}
${p.tone ? `Tone: ${p.tone}` : ''} ${p.always_emphasize ? `Always emphasize: ${p.always_emphasize}` : ''} ${p.avoid_words ? `Avoid: ${p.avoid_words}` : ''} ${p.never_change ? `Never change: ${p.never_change}` : ''}

Return JSON only.`;

    let res;
    let usedTemplate = false;
    try {
      res = await base44.integrations.Core.InvokeLLM({
      prompt,
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
    } catch (error) {
      console.warn('AI distribution unavailable; preparing editable templates:', error?.message || 'unknown');
      usedTemplate = true;
      res = { posts: templatePosts(campaign, targets) };
    }
    if (!Array.isArray(res?.posts) || !res.posts.length) {
      usedTemplate = true;
      res = { posts: templatePosts(campaign, targets) };
    }

    const created = [];
    const generatedPosts = Array.isArray(res.posts) ? res.posts : [];
    const matchedIds = new Set();
    const drafts = [];
    for (const post of generatedPosts) {
      const match = targets.find((c) => c.id === post.connection_id && !matchedIds.has(c.id)) || targets.find((c) => c.platform === post.platform && !matchedIds.has(c.id));
      if (!match || typeof post.content !== 'string' || !post.content.trim()) continue;
      matchedIds.add(match.id);
      drafts.push({ ...post, connection_id: match.id });
    }
    const missing = targets.filter((c) => !matchedIds.has(c.id));
    if (missing.length) {
      usedTemplate = true;
      drafts.push(...templatePosts(campaign, missing));
    }
    for (const post of drafts) {
      const conn = targets.find((c) => c.id === post.connection_id);
      if (!conn || !post.content) continue;
      // Never trust an LLM-generated URL for checkout. Crowdfunding updates
      // are copyable text for the existing fundraiser; social appeals receive
      // exactly the creator-selected support link, not a competing rail.
      const preparedText = String(post.content).replace(/https?:\/\/[^\s]+/gi, '').trim();
      const content = conn.kind === 'social'
        ? preparedText + generateDonationBlock(destination.url)
        : preparedText;
      const record = await base44.entities.DistributedPost.create({
        campaign_id,
        campaign_title: campaign.title,
        connection_id: conn.id,
        platform: conn.platform,
        content,
        hashtags: post.hashtags || [],
        donation_destination_url: destination.url,
        donation_destination_platform: destination.platform,
        status: conn.automation_mode === 'draft' ? 'draft' : 'pending_approval',
      });
      created.push(record);
    }
    return Response.json({ posts: created, used_template: usedTemplate });
  } catch (error) {
    console.error('generateDistributionContent error:', error.message);
    return Response.json({ error: 'Unable to generate distribution content. Please try again.' }, { status: 500 });
  }
}