import { isFeatureEnabled, featureUnavailable } from '../../shared/featureFlagGate.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { checkRateLimit } from '../../shared/rateLimit.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    if (!(await isFeatureEnabled(base44, 'ai_campaign_assistant'))) return featureUnavailable('AI intelligence');
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { mode } = await req.json();

    // Gather permission-scoped context: only the user's own campaigns and their activity
    const campaigns = await base44.entities.Campaign.filter({ created_by_id: user.id });
    if (campaigns.length === 0) {
      return Response.json({ error: 'Create a campaign first so Mission Control has something to analyze.' }, { status: 400 });
    }

    // Rate limit (persistent): Mission Control runs an expensive LLM pass.
    const rl = await checkRateLimit(base44, `generateIntelligence:${user.id}`, 3, 300);
    if (!rl.allowed) {
      return Response.json({ error: 'Mission Control is still working on your last request. Please wait a few minutes and try again.' }, { status: 429 });
    }

    const campaignIds = campaigns.map((c) => c.id);
    const donations = await base44.asServiceRole.entities.Donation.filter({ campaign_id: { $in: campaignIds } });
    const messages = await base44.entities.Message.filter({ created_by_id: user.id }, '-created_date', 20);

    const context = {
      today: new Date().toISOString().slice(0, 10),
      campaigns: campaigns.map((c) => ({
        id: c.id,
        title: c.title,
        category: c.category,
        status: c.status,
        goal: c.goal_amount,
        raised: c.raised_amount || 0,
        donors: c.donor_count || 0,
        has_story: !!(c.story && c.story.length > 200),
        has_cover_image: !!c.cover_image_url,
        end_date: c.end_date || null,
        created: c.created_date,
      })),
      donation_activity: {
        total_donations: donations.length,
        total_raised: donations.reduce((s, d) => s + (d.amount || 0), 0),
        recurring_active: donations.filter((d) => d.is_recurring && (d.recurring_status || 'active') === 'active').length,
        last_donation_date: donations.length ? donations.map((d) => d.created_date).sort().pop() : null,
      },
      communications: {
        messages_sent: messages.length,
        last_sent: messages[0]?.sent_at || null,
      },
    };

    if (mode === 'opportunities') {
      const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are the Opportunity Discovery Agent for a fundraising platform. Using current real-world information, find concrete funding and growth opportunities for these campaigns: ${JSON.stringify(context.campaigns.map((c) => ({ title: c.title, category: c.category, goal: c.goal })))}. Look for grant programs, corporate giving/matching gift programs, foundations, community partnerships, and media opportunities relevant to these categories. Only include opportunities you have real evidence for — never invent programs. For each, state eligibility, required actions, an estimated value range if known, your confidence (high/medium/low), and the source.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            opportunities: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  type: { type: 'string', enum: ['grant', 'matching_gift', 'corporate_giving', 'foundation', 'business', 'community', 'media', 'event', 'other'] },
                  description: { type: 'string' },
                  estimated_value: { type: 'string' },
                  eligibility: { type: 'string' },
                  required_actions: { type: 'string' },
                  confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                  source: { type: 'string' },
                },
              },
            },
          },
        },
      });
      const opportunities = (res.opportunities || []).slice(0, 8);
      const created = opportunities.length
        ? await base44.entities.Opportunity.bulkCreate(opportunities.map((o) => ({ ...o, status: 'open' })))
        : [];
      return Response.json({ ok: true, opportunities: created });
    }

    // Default mode: strategic briefing + ranked recommendations
    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are Mission Control, the strategic intelligence layer of a fundraising platform. Analyze this organizer's data and produce a strategic briefing and ranked recommendations. Be specific, evidence-based, and honest — cite the actual numbers from the data as evidence, never invent facts. Predictions are estimates, never guarantees. Data: ${JSON.stringify(context)}. Produce: a 2-3 sentence summary; 2-3 priorities for today; 2-3 for this week; 2-3 long-term objectives; 1-3 risks; 1-3 predictions (each with confidence high/medium/low, evidence from the data, and a recommended action); and 3-5 ranked recommendations (each tied to a campaign_id from the data where relevant, with description, reasoning, evidence, confidence, expected_impact, estimated_effort, and the responsible agent: strategy, growth, communications, story, or finance).`,
      response_json_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          today_priorities: { type: 'array', items: { type: 'string' } },
          week_priorities: { type: 'array', items: { type: 'string' } },
          long_term: { type: 'array', items: { type: 'string' } },
          risks: { type: 'array', items: { type: 'string' } },
          predictions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                forecast: { type: 'string' },
                confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                evidence: { type: 'string' },
                recommended_action: { type: 'string' },
              },
            },
          },
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                campaign_id: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                reasoning: { type: 'string' },
                evidence: { type: 'string' },
                confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                expected_impact: { type: 'string' },
                estimated_effort: { type: 'string' },
                agent: { type: 'string', enum: ['strategy', 'growth', 'communications', 'story', 'finance'] },
              },
            },
          },
        },
      },
    });

    // Refresh the living strategic plan (one brief per user)
    const briefData = {
      summary: res.summary || '',
      today_priorities: res.today_priorities || [],
      week_priorities: res.week_priorities || [],
      long_term: res.long_term || [],
      risks: res.risks || [],
      predictions: res.predictions || [],
      generated_at: new Date().toISOString(),
    };
    const existingBriefs = await base44.asServiceRole.entities.MissionBrief.filter({ created_by_id: user.id });
    let brief;
    if (existingBriefs.length > 0) {
      brief = await base44.asServiceRole.entities.MissionBrief.update(existingBriefs[0].id, briefData);
    } else {
      brief = await base44.entities.MissionBrief.create(briefData);
    }

    // Non-repetitive: replace previously open recommendations with the fresh ranked set
    await base44.asServiceRole.entities.Recommendation.deleteMany({ created_by_id: user.id, status: 'open' });
    const recs = (res.recommendations || []).slice(0, 5).map((r) => ({
      ...r,
      campaign_title: campaigns.find((c) => c.id === r.campaign_id)?.title || '',
      status: 'open',
    }));
    const createdRecs = recs.length ? await base44.entities.Recommendation.bulkCreate(recs) : [];

    return Response.json({ ok: true, brief, recommendations: createdRecs });
  } catch (error) {
    console.error('generateIntelligence error:', error.message);
    return Response.json({ error: 'Mission Control could not complete your analysis. Please try again.' }, { status: 500 });
  }
}