import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Triggered by the "Grant Application Review" workflow when a new grant
// application is submitted. Runs the Strategy Agent's analysis (via InvokeLLM)
// to assess fit and recommend a decision, records a Recommendation for the
// institution owner, moves the application to under_review, and notifies the
// owner to review and decide.
//
// Per the platform principle "AI recommends but never executes without human
// approval," this does NOT auto-award grants — the owner awards via the
// existing decideGrantApplication, which notifies the applicant and records
// the institutional donation.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const { application_id } = await req.json();
    if (!application_id) return Response.json({ error: 'Missing application_id' }, { status: 400 });

    const app = await sr.entities.GrantApplication.get(application_id).catch(() => null);
    if (!app) return Response.json({ error: 'Application not found' }, { status: 404 });

    const [institution, opportunity, campaign] = await Promise.all([
      sr.entities.Institution.get(app.institution_id).catch(() => null),
      app.opportunity_id ? sr.entities.InstitutionOpportunity.get(app.opportunity_id).catch(() => null) : null,
      app.campaign_id ? sr.entities.Campaign.get(app.campaign_id).catch(() => null) : null,
    ]);

    const prompt = `You are the Strategy Agent for the Interplanetary Fund. Assess this grant application's fit and recommend a decision. Never fabricate facts; be concise.

Institution: ${institution?.name || 'n/a'} (${institution?.type || 'n/a'}) — mission: ${institution?.mission || 'n/a'}
Opportunity: ${opportunity?.title || 'n/a'} — award: ${opportunity?.award_amount || 'n/a'} — eligibility: ${opportunity?.eligibility || 'n/a'} — deadline: ${opportunity?.deadline || 'n/a'}
Campaign: ${campaign?.title || 'n/a'} — goal: ${campaign?.goal_amount || 'n/a'} — raised: ${campaign?.raised_amount || 'n/a'} — category: ${campaign?.category || 'n/a'}
Applicant: ${app.applicant_name || 'n/a'}
Requested amount: ${app.requested_amount || 'n/a'}
Narrative: ${app.narrative || 'n/a'}

Return a JSON recommendation.`;

    const analysis = await sr.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          recommendation: { type: "string", enum: ["award", "decline", "under_review"] },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          reasoning: { type: "string" },
          suggested_next_step: { type: "string" },
        },
      },
    });

    // Move to under_review — the AI has reviewed it; the owner now decides.
    await sr.entities.GrantApplication.update(application_id, { status: 'under_review' });

    await sr.entities.Recommendation.create({
      owner_user_id: institution?.created_by_id || app.applicant_user_id,
      campaign_id: app.campaign_id || '',
      campaign_title: app.campaign_title || campaign?.title || '',
      title: `Grant application review: ${app.opportunity_title || 'Opportunity'}`,
      description: analysis.suggested_next_step || 'Review this grant application and decide.',
      reasoning: analysis.reasoning || '',
      evidence: `AI recommendation: ${analysis.recommendation} (confidence: ${analysis.confidence || 'medium'})`,
      confidence: analysis.confidence || 'medium',
      agent: 'strategy',
      status: 'open',
    });

    if (institution?.created_by_id) {
      await sr.entities.Notification.create({
        user_id: institution.created_by_id,
        title: 'New grant application to review',
        body: `${app.applicant_name || 'An applicant'} applied for "${app.opportunity_title}". AI suggests: ${analysis.recommendation}. Review and decide.`,
        type: 'system',
        link: '/institutions',
      });
    }

    return Response.json({ ok: true, recommendation: analysis.recommendation, confidence: analysis.confidence });
  } catch (error) {
    console.error('analyzeGrantApplication error:', error.message);
    return Response.json({ error: 'Unable to analyze the application. Please try again.' }, { status: 500 });
  }
}