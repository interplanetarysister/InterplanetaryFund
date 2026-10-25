import { isFeatureEnabled, featureUnavailable } from '../../shared/featureFlagGate.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { hasSubscriptionLevel } from '../../shared/subscriptionEntitlements.ts';
import { hasUnifiedOboConsent } from '../../shared/integrationRegistry.ts';
import { latestWritingGuidance } from '../../shared/writingGuidance.ts';

// Autonomous AI Outreach Agent runner. Invoked on a schedule (no user context),
// so all work is service-scoped. For each campaign opted into the agent whose
// owner holds an active outreach-tier subscription, it analyzes the campaign
// and records recommendations + an activity log entry. Every artifact stays
// truthful and is left for the owner to approve, reject, edit, or pause.

const MAX_ANALYSES_PER_RUN = 5;
const SUCCESS_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 2 * 60 * 60 * 1000;

const COMPLIANCE = `Compliance and safety (non-negotiable):
- Never fabricate facts, names, amounts, dates, statistics, or outcomes.
- Only use information provided in the campaign context; omit anything unknown.
- Never create false urgency, promise outcomes, or misrepresent facts.
- Never recommend spamming, harassment, or circumventing platform policies.
- Respect privacy, anti-spam rules, and platform terms.`;

function buildContext(campaign, donationsCount, updatesCount) {
  const p = campaign.ai_profile || {};
  const lines = [];
  if (campaign.title) lines.push(`Title: ${campaign.title}`);
  if (campaign.category) lines.push(`Category: ${campaign.category}`);
  if (campaign.summary) lines.push(`Summary: ${campaign.summary}`);
  if (campaign.goal_amount) lines.push(`Goal: $${campaign.goal_amount}`);
  if (campaign.raised_amount != null) lines.push(`Raised: $${campaign.raised_amount || 0} from ${campaign.donor_count || 0} donors`);
  if (donationsCount != null) lines.push(`Recent donations: ${donationsCount}`);
  if (updatesCount != null) lines.push(`Updates posted: ${updatesCount}`);
  if (p.tone) lines.push(`Preferred tone: ${p.tone}`);
  if (p.priority) lines.push(`Priority: ${p.priority}`);
  if (p.always_emphasize) lines.push(`Always emphasize: ${p.always_emphasize}`);
  if (p.never_change) lines.push(`Never change: ${p.never_change}`);
  if (p.avoid_words) lines.push(`Avoid: ${p.avoid_words}`);
  const supporterNotes = [...new Set([
    p.donor_discovery_notes, p.ideal_donors, p.interested_orgs,
  ].map((text) => String(text || '').trim()).filter(Boolean))].join('\n');
  if (supporterNotes) lines.push(`Optional creator supporter ideas and boundaries: ${supporterNotes}`);
  lines.push('Research likely supporters from the campaign facts. Creator ideas are optional context, not a fixed audience restriction.');
  if (p.platforms && p.platforms.length) lines.push(`Sharing platforms: ${p.platforms.join(', ')}`);
  return lines.join('\n') || 'No campaign context available.';
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    if (!(await isFeatureEnabled(base44, 'ai_outreach_agent'))) return Response.json({ skipped: true, flag: 'ai_outreach_agent', reason: 'disabled' });
    const sr = base44.asServiceRole;

    const campaigns = await sr.entities.Campaign.filter(
      { outreach_enabled: true, status: 'active' }, '-updated_date', 200);
    const processed = [];
    const research = await latestWritingGuidance(sr);
    const now = Date.now();
    const recent = (value, windowMs) => {
      const parsed = Date.parse(String(value || ''));
      return Number.isFinite(parsed) && now - parsed >= 0 && now - parsed < windowMs;
    };
    // Rotate fairly across opted-in campaigns. The old first-five loop
    // analyzed the same campaigns forever and never reached later owners.
    // Cooldowns also prevent repeated metered LLM use and duplicate drafts.
    const due = (campaigns || []).filter((c) => !c.outreach_paused &&
      !recent(c.outreach_last_run_at, SUCCESS_COOLDOWN_MS) &&
      !recent(c.outreach_last_attempt_at, FAILURE_COOLDOWN_MS))
      .sort((a, b) => (Date.parse(a.outreach_last_attempt_at || '') || 0) -
        (Date.parse(b.outreach_last_attempt_at || '') || 0));
    let attempts = 0;
    for (const campaign of due) {
      if (attempts >= MAX_ANALYSES_PER_RUN) break;
      try {

      const owner = await sr.entities.User.get(campaign.created_by_id).catch(() => null);
      // Skip campaigns whose owner account is revoked (pending deletion, disabled,
      // or already gone) so the agent never works on behalf of a deactivated user.
      if (!owner || owner.account_deletion_pending || (owner.account_status && owner.account_status !== 'active')) {
        processed.push({ id: campaign.id, skipped: 'owner account unavailable' });
        continue;
      }
      if (!hasSubscriptionLevel(owner, 2)) {
        processed.push({ id: campaign.id, skipped: 'outreach entitlement unavailable' });
        continue;
      }
      if (!hasUnifiedOboConsent(owner)) {
        processed.push({ id: campaign.id, skipped: 'owner AI help not authorized' });
        continue;
      }

      // Reserve this campaign's cooldown before requesting a metered AI
      // analysis. Owner auth and tier were verified above.
      await sr.entities.Campaign.update(campaign.id, {
        outreach_last_attempt_at: new Date().toISOString(),
      });
      attempts++;
      const donations = await sr.entities.Donation.filter({ campaign_id: campaign.id }, '-created_date', 100);
      const updates = await sr.entities.CampaignUpdate.filter({ campaign_id: campaign.id });
      const context = buildContext(campaign, donations.length, updates.length);

      const prompt = `You are an autonomous fundraising outreach agent working on behalf of an Interplanetary Fund campaign creator. The creator approves every action you propose.
${COMPLIANCE}
Current research-grounded writing guidance: ${research || 'Use clear, credible, donor-centered messaging.'}
Apply the campaign creator's intended audience and tone; write persuasively but only from real campaign facts. Contrarian framing is acceptable when truthful and respectful.

Based on the campaign below, produce:
1. Two specific, actionable recommendations to improve outreach and fundraising (truthful, no invented facts).
2. One short outreach message draft (under 120 words, plain text, warm, no placeholders) the creator can send to likely supporters.
3. The single most important next action the creator should take.

Return JSON only matching the schema.

Campaign context:
${context}`;

      const res = await sr.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  expected_impact: { type: 'string' },
                  reasoning: { type: 'string' },
                },
              },
            },
            draft_message: { type: 'string' },
            next_action: { type: 'string' },
          },
        },
      });

      if (!res || (!Array.isArray(res.recommendations) && !res.draft_message)) {
        throw new Error('Outreach analysis returned no usable result.');
      }
      const ownerId = campaign.created_by_id;
      const recIds = [];
      for (const r of (res.recommendations || [])) {
        const rec = await sr.entities.Recommendation.create({
          campaign_id: campaign.id,
          campaign_title: campaign.title,
          owner_user_id: ownerId,
          title: r.title,
          description: r.description,
          expected_impact: r.expected_impact,
          reasoning: r.reasoning,
          agent: 'outreach',
          status: 'open',
        });
        recIds.push(rec.id);
      }

      const draftMessage = typeof res?.draft_message === 'string'
        ? res.draft_message.trim().slice(0, 2500) : '';
      const nextActions = [
        res.next_action,
        'Review the draft outreach message and approve or edit it before sending to supporters.',
      ].filter(Boolean);

      await sr.entities.AgentActivity.create({
        campaign_id: campaign.id,
        campaign_title: campaign.title,
        owner_user_id: ownerId,
        category: 'outreach',
        action: 'Ran autonomous outreach analysis and generated recommendations plus a draft outreach message.',
        reason: 'Campaign is opted into the AI Outreach Agent; periodic monitoring improves outreach performance.',
        expected_impact: 'Sharper audience targeting and ready-to-send donor messaging.',
        result: `Generated ${recIds.length} recommendation(s)${draftMessage ? ' and an outreach draft' : ''}.`,
        description: draftMessage,
        recommended_next_actions: nextActions,
        artifact_type: 'recommendation',
        artifact_id: recIds[0] || undefined,
        status: 'pending',
      });

      await sr.entities.Campaign.update(campaign.id, {
        outreach_last_run_at: new Date().toISOString(), outreach_last_error: '',
      });
      processed.push({ id: campaign.id, recommendations: recIds.length });
      } catch (campaignError) {
        console.error('runOutreachAgent campaign failed:', campaignError?.name || 'UnknownError');
        await sr.entities.Campaign.update(campaign.id, {
          outreach_last_error: 'Analysis could not be completed. It will be retried after a cooldown.',
        }).catch(() => {});
        processed.push({ id: campaign.id, skipped: 'analysis unavailable; retry on next run' });
      }
    }

    return Response.json({ processed });
  } catch (error) {
    console.error('runOutreachAgent error:', error.message);
    return Response.json({ error: 'The Outreach Agent hit a problem and could not finish this run.' }, { status: 500 });
  }
}