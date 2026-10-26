import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { IFUND_SIGNATURE_STYLE } from '../../shared/ifundSignatureStyle.ts';
import { latestWritingGuidance } from '../../shared/writingGuidance.ts';

// AI Social Content Generator — creates official Interplanetary Fund social
// posts about platform features, with signature-style AI imagery. Admin-only.
// Each call generates one post; the admin can trigger it repeatedly.

const SIGNATURE_STYLE = 'Interplanetary Fund signature art direction: cyberpunk, steampunk, afropunk/afrofuturist, interplanetary and celestial visual language, cinematic realism with subtle comic-book energy, retro-futurist mechanical detail, sophisticated cool-toned lighting, human-centered and hopeful. No text, no watermark, no logos.';

const TOPICS = [
  {
    id: 'universal_donation_button',
    feature: 'Universal Donation Button',
    description: 'One permanent URL that works everywhere — websites, blogs, QR codes, social bios. Every click opens your donation page.',
    benefit: 'Never lose a donor to a broken or outdated link again.',
    how_to: 'Go to any campaign, open the Share Kit, and copy the embed code or link.',
    image_prompt: 'A glowing futuristic donate button floating in deep space, surrounded by interconnected platform icons and celestial constellations, networks of light connecting them',
  },
  {
    id: 'cross_platform_sync',
    feature: 'Linked Campaign Workspace',
    description: 'IFund helps organize one campaign and prepare platform-specific promotions. Creators can link existing fundraisers on supported providers; automated creation on external crowdfunding sites is not yet verified.',
    benefit: 'Keep linked campaigns and promotional drafts in one workspace while each external provider keeps control of its campaigns and payments.',
    how_to: 'Open Connections, link an existing external fundraiser, and press Sync now when you want a supported on-demand refresh. Imported or entered totals may be informational.',
    image_prompt: 'A holographic dashboard floating in space, multiple planet-like platforms orbiting and connected by streams of light to a central command center',
  },
  {
    id: 'ai_campaign_coach',
    feature: 'AI Campaign Coach',
    description: 'Your personal AI strategist that analyzes your campaign and recommends improvements in real time.',
    benefit: 'Get expert-level guidance on storytelling, outreach, and optimization — 24/7.',
    how_to: 'Open Mission Control on any campaign to see live AI recommendations.',
    image_prompt: 'An AI holographic mentor figure guiding a person through a constellation map of campaign strategies, cosmic neural network patterns, glowing with cool blue light',
  },
  {
    id: 'treasury_management',
    feature: 'Treasury Management',
    description: 'Real-time tracking of every dollar raised, held, and paid out — with a 7-day clearing period for institutional donations.',
    benefit: 'Full financial transparency and security for you and your donors.',
    how_to: 'Check the Treasury Snapshot on your dashboard for live balance tracking.',
    image_prompt: 'A crystalline treasury vault floating in orbit, golden light streams flowing through transparent walls, holographic balance displays, secure and luminous',
  },
  {
    id: 'community_hub',
    feature: 'Community Hub',
    description: 'Bring your supporters together with discussions, volunteer coordination, and live activity feeds.',
    benefit: 'Turn one-time donors into a lasting community.',
    how_to: 'Visit the Community page to create or join a community.',
    image_prompt: 'A vibrant space station community gathering, diverse people connecting around holographic displays, warm light mixing with cool cosmic tones, hopeful and energetic',
  },
  {
    id: 'institution_grants',
    feature: 'Institution & Grant Matching',
    description: 'Connect with foundations and institutions offering grants, and apply directly through Interplanetary Fund.',
    benefit: 'Unlock institutional funding without the paperwork nightmare.',
    how_to: 'Browse the Institutions page to discover matching grant opportunities.',
    image_prompt: 'A grand cosmic library with floating grant documents, an interstellar institution building accessed through a portal of light, aspirational and vast',
  },
  {
    id: 'social_rewards',
    feature: 'Social Rewards',
    description: 'Post on the Interplanetary Fund social feed and earn points toward exclusive profile banners and top-feed placement.',
    benefit: 'Get rewarded for building your audience and spreading your mission.',
    how_to: 'Share posts on the Social page to climb from Bronze to Platinum tier.',
    image_prompt: 'A collection of glowing tier badges floating in space — bronze, silver, gold, and platinum planetary bodies ascending in orbit, a rewards constellation',
  },
  {
    id: 'global_globe',
    feature: 'Global Activity Globe',
    description: 'See every campaign and donation happening across the world in real time on an interactive 3D globe.',
    benefit: 'Witness the global impact of collective giving as it happens.',
    how_to: 'Visit the Globe page to explore live worldwide activity.',
    image_prompt: 'A luminous Earth seen from space with glowing points of light where campaigns are active, rivers of light connecting continents, breathtaking and hopeful',
  },
];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const topicId = body.topic_id;
    const topic = topicId
      ? TOPICS.find((t) => t.id === topicId)
      : TOPICS[Math.floor(Math.random() * TOPICS.length)];

    if (!topic) return Response.json({ error: 'Topic not found' }, { status: 400 });

    // Generate post text with current source-backed audience research.
    const research = await latestWritingGuidance(base44.asServiceRole);
    const textRes = await base44.integrations.Core.InvokeLLM({
      prompt: `Write a social media post for the Interplanetary Fund platform about the "${topic.feature}" feature.
        
        Current weekly donor psychology / trend reference: ${research || 'Use authentic, audience-aware persuasion.'}
        Only present a capability as live if verified in IFund's current records. Treat prelaunch features as plans.
        Feature description: ${topic.description}
        Key benefit: ${topic.benefit}
        How to use: ${topic.how_to}
        
        The post should:
        - Be inspiring and cosmic in tone
        - Explain what the feature does and how it helps
        - Mention the benefit it brings
        - Include a brief "how to use" hint
        - Be under 280 characters
        - Use at most one emoji
        - No hashtags
        
        Return JSON only.`,
      response_json_schema: {
        type: 'object',
        properties: {
          post_text: { type: 'string' },
        },
      },
    });

    // Generate signature-style image
    const imageRes = await base44.integrations.Core.GenerateImage({
      prompt: `${topic.image_prompt}. ${IFUND_SIGNATURE_STYLE}`,
    });

    // Never create a media post with a broken or missing generator result.
    const mediaUrl = imageRes?.url || imageRes?.image_url || imageRes?.images?.[0]?.url;
    if (typeof mediaUrl !== 'string' || !/^https:\/\//i.test(mediaUrl))
      return Response.json({ error: 'The generated image was not available. Please retry.' }, { status: 502 });

    // Return an unpublished draft. The client must bake the official logo
    // and domain watermark into the image and save it before publication.
    if (!textRes?.post_text) return Response.json({ error: 'No post text generated.' }, { status: 502 });
    return Response.json({ draft: { content: textRes.post_text, generated_image_url: mediaUrl }, topic: topic.feature, watermark_required: true });
  } catch (error) {
    console.error('generateSocialContent error:', error.message);
    return Response.json({ error: 'Unable to generate social content. Please try again.' }, { status: 500 });
  }
}