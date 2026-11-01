import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { hasSubscriptionLevel } from '../../shared/subscriptionEntitlements.ts';

// Read-only, secret-free research reference for user writing agents.
export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const active = await assertActiveAccount(base44);
    if (!active.ok) return Response.json({ error: active.error }, { status: active.status });
    const user = active.user;
    if (!hasSubscriptionLevel(user,1)) return Response.json({ error: 'AI writing requires an eligible subscription.' }, { status: 403 });
    const rows = await base44.asServiceRole.entities.WritingResearchBrief.filter(
      { status: 'verified_sources' }, '-created_date', 1);
    const brief = (rows || [])[0];
    if (!brief) return Response.json({
      available: false, message: 'No independently researched weekly brief is available yet. Use standard factual writing principles.',
    });
    return Response.json({
      available: true, week: brief.week_key, summary: brief.summary,
      guidance: (brief.guidance || []).slice(0, 15),
      study_facts: (brief.study_facts || []).slice(0, 8),
      trend_observations: (brief.trend_observations || []).slice(0, 7),
      unverified_claims: (brief.unverified_claims || []).slice(0, 8),
      source_urls: (brief.source_urls || []).slice(0, 10),
      reminder: 'These are general research findings, not proof about this campaign or about IFund rankings. Preserve user choices and campaign facts.',
    }, { headers: { 'Cache-Control': 'private, max-age=300' }});
  } catch (error) {
    console.error('getWritingResearchBrief error', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ error: 'Research guidance could not be loaded.' }, { status: 500 });
  }
}
