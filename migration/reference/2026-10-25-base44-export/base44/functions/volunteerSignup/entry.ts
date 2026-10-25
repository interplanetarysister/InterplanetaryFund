import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

// Signs the current user up for a volunteer opportunity. Creates the
// VolunteerSignup as the user and increments the opportunity's volunteer_count
// as the service role (VolunteerOpportunity.update is owner-only under RLS).
// Dedupes one signup per user per opportunity and notifies the publisher.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;

    const { opportunity_id } = await req.json();
    if (!opportunity_id) return Response.json({ error: 'Missing opportunity_id' }, { status: 400 });

    const sr = base44.asServiceRole;
    const opp = await sr.entities.VolunteerOpportunity.get(opportunity_id).catch(() => null);
    if (!opp) return Response.json({ error: 'Opportunity not found' }, { status: 404 });
    if (opp.status !== 'open') return Response.json({ error: 'This opportunity is no longer open.' }, { status: 400 });

    const existing = await sr.entities.VolunteerSignup.filter({ opportunity_id, user_id: user.id });
    if (existing && existing.length) return Response.json({ error: 'You already signed up.' }, { status: 400 });

    const signup = await base44.entities.VolunteerSignup.create({
      opportunity_id,
      community_id: opp.community_id,
      user_id: user.id,
      user_name: user.full_name || user.email,
    });
    // Atomic increment — avoids the read-modify-write race on concurrent signups.
    await sr.entities.VolunteerOpportunity.updateMany(
      { id: opportunity_id },
      { $inc: { volunteer_count: 1 } }
    );

    if (opp.created_by_id && opp.created_by_id !== user.id) {
      await sr.entities.Notification.create({
        user_id: opp.created_by_id,
        title: 'New volunteer signup',
        body: `${user.full_name || user.email} signed up for "${opp.role_title}"`,
        type: 'system',
        link: `/community/${opp.community_id}`,
      });
    }
    return Response.json({ signup });
  } catch (error) {
    console.error('volunteerSignup error:', error.message);
    return Response.json({ error: 'Unable to sign you up. Please try again.' }, { status: 500 });
  }
}