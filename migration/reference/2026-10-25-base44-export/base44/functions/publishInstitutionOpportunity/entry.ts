import { isFeatureEnabled, featureUnavailable } from '../../shared/featureFlagGate.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

// Publishes a grant/funding opportunity for an institution. Verifies the caller
// owns the institution, creates the opportunity as the user (owner = creator,
// so RLS update/delete later work for them), and increments the institution's
// opportunity_count as the service role (Institution.update is owner-only).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    if (!(await isFeatureEnabled(base44, 'institution_programs'))) return featureUnavailable('New institution opportunities');
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in to publish an opportunity.' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { institution_id, title, category, description, award_amount, eligibility, requirements, deadline } = body;
    const safeTitle = String(title || '').trim();
    if (!institution_id || !safeTitle || safeTitle.length > 200) return Response.json({ error: 'A valid title is required.' }, { status: 400 });
    const safeCategory = String(category || 'grant').slice(0, 80);
    const safeDescription = String(description || '').slice(0, 10000);
    const safeAward = String(award_amount || '').slice(0, 300);
    const safeEligibility = String(eligibility || '').slice(0, 5000);
    const safeRequirements = String(requirements || '').slice(0, 5000);

    const sr = base44.asServiceRole;
    const institution = await sr.entities.Institution.get(institution_id).catch(() => null);
    if (!institution) return Response.json({ error: 'Institution not found' }, { status: 404 });
    if (institution.created_by_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the institution owner can publish opportunities.' }, { status: 403 });
    }

    const opportunity = await base44.entities.InstitutionOpportunity.create({
      institution_id,
      institution_name: institution.name,
      title: safeTitle,
      category: safeCategory,
      description: safeDescription,
      award_amount: safeAward,
      eligibility: safeEligibility,
      requirements: safeRequirements,
      deadline: deadline || undefined,
      status: 'open',
    });
    // Atomic increment — avoids the read-modify-write race on concurrent publishes.
    await sr.entities.Institution.updateMany(
      { id: institution_id },
      { $inc: { opportunity_count: 1 } }
    );
    return Response.json({ opportunity });
  } catch (error) {
    console.error('publishInstitutionOpportunity error:', error?.name || 'UnknownError');
    return Response.json({ error: 'Unable to publish the opportunity. Please try again.' }, { status: 500 });
  }
}