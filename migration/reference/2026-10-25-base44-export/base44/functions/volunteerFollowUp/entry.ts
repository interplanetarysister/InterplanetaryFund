import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Three days after a volunteer signs up, sends a follow-up invite to complete
// their profile — but only if they haven't completed onboarding (our proxy for
// "hasn't updated their profile"). Runs from the workflow, service-scoped.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const { signup_id } = await req.json();
    if (!signup_id) return Response.json({ error: 'Missing signup_id' }, { status: 400 });

    const signup = await sr.entities.VolunteerSignup.get(signup_id).catch(() => null);
    if (!signup) return Response.json({ skipped: true, reason: 'signup removed' });

    const user = signup.user_id ? await sr.entities.User.get(signup.user_id).catch(() => null) : null;
    if (!user) return Response.json({ skipped: true, reason: 'user removed' });

    // Proxy for "hasn't updated their profile": onboarding not yet completed.
    if (user.onboarding_completed) return Response.json({ skipped: true, reason: 'profile complete' });

    const opp = await sr.entities.VolunteerOpportunity.get(signup.opportunity_id).catch(() => null);
    const community = signup.community_id ? await sr.entities.Community.get(signup.community_id).catch(() => null) : null;
    const roleTitle = opp?.role_title || 'your volunteer role';
    const communityName = community?.name || 'us';

    if (user.email && (user.comm_prefs || {}).email_updates !== false) {
      try {
        await sr.integrations.Core.SendEmail({
          to: user.email,
          subject: `Ready for your next step with ${communityName}?`,
          body: `Hi ${user.full_name || 'there'},\n\nYou signed up for "${roleTitle}" a few days ago. Complete your profile so we can match you to more opportunities and tasks tailored to you.\n\nFinish setup: open your Interplanetary Fund profile.\n\n— Interplanetary Fund`,
          from_name: 'Interplanetary Fund',
        });
      } catch (e) {
        console.error('follow-up email failed:', e.message);
      }
    }

    await sr.entities.Notification.create({
      user_id: signup.user_id,
      title: 'Complete your profile to unlock more tasks',
      body: `You're signed up for ${roleTitle}. Finish your profile so we can match you to more opportunities.`,
      type: 'system',
      link: '/profile',
    });

    return Response.json({ ok: true, followed_up: true });
  } catch (error) {
    console.error('volunteerFollowUp error:', error.message);
    return Response.json({ error: 'Unable to send the follow-up. Please try again.' }, { status: 500 });
  }
}