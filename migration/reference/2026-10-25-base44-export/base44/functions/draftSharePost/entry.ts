import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { latestWritingGuidance } from '../../shared/writingGuidance.ts';

// AI Share Draft — a user clicks "Share to your profile" on a campaign or
// social post, and this function generates an AI-drafted post they can review
// and approve before it's shared to their connected external accounts.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;

    const { source_type, source_id } = await req.json();
    if (!source_type || !source_id) {
      return Response.json({ error: 'Source type and ID are required.' }, { status: 400 });
    }

    let sourceContext = '';
    let sourceTitle = '';

    if (source_type === 'campaign') {
      const campaign = await base44.entities.Campaign.get(source_id).catch(() => null);
      if (!campaign) return Response.json({ error: 'Campaign not found.' }, { status: 404 });
      sourceTitle = campaign.title;
      sourceContext = `Campaign: ${campaign.title}
Summary: ${campaign.summary || ''}
Goal: $${campaign.goal_amount} | Raised: $${campaign.raised_amount || 0} from ${campaign.donor_count || 0} donors
Story excerpt: ${(campaign.story || '').slice(0, 800)}`;
    } else if (source_type === 'social_post') {
      const post = await base44.entities.SocialPost.get(source_id).catch(() => null);
      if (!post) return Response.json({ error: 'Post not found.' }, { status: 404 });
      sourceTitle = `Re: ${post.author_name}'s post`;
      sourceContext = `Original post by ${post.author_name}:
${post.content}`;
    } else {
      return Response.json({ error: 'Invalid source type.' }, { status: 400 });
    }

    const research = await latestWritingGuidance(base44.asServiceRole);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an AI agent for the Interplanetary Fund platform. A user wants to share this content to their social media profile. Draft a post they can approve.

General weekly public research writing guidance: ${research || 'Use relatable, original, specific and truthful motivations.'}
Use persuasive audience-aware word choice while respecting the original creator and voluntary donor choices. No invented urgency, social proof, results or trust rankings.

Source content:
${sourceContext}

Write a shareable social post that:
- Is authentic and personal (the user is sharing this)
- Is inspiring and concise (under 280 characters)
- Encourages engagement
- Uses at most one emoji, no hashtags
- Adapts the tone to be warm and community-focused

Return JSON only.`,
      response_json_schema: {
        type: 'object',
        properties: {
          draft_text: { type: 'string' },
        },
      },
    });

    return Response.json({ draft_text: res.draft_text, source_title: sourceTitle });
  } catch (error) {
    console.error('draftSharePost error:', error.message);
    return Response.json({ error: 'Unable to draft post. Please try again.' }, { status: 500 });
  }
}