import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { effectiveSubscription } from '../../shared/subscriptionEntitlements.ts';

// Scans a user's account for Interplanetary Fund features they haven't used yet
// and creates one open Recommendation per unused feature (deduped — won't
// recreate a feature that already has an open Recommendation for that user).
// Triggered on campaign completion (workflow) and by the dashboard "Discover
// features" button. Service-scoped.
const FEATURE_CHECKS = [
  { key: "connect-a-platform", title: "Connect a crowdfunding or social platform", body: "Link GoFundMe, Ko-fi, Instagram and more so one campaign reaches everywhere.", link: "/connections" },
  { key: "join-a-community", title: "Join or start a community", body: "Communities unlock volunteer opportunities and group coordination around your cause.", link: "/community" },
  { key: "invite-an-institution", title: "Add an institution", body: "Add a foundation, business, or nonprofit to discover grants, matching gifts, and volunteer programs.", link: "/institutions" },
  { key: "volunteer", title: "Volunteer for an opportunity", body: "Lend your time to a community role that matches your skills.", link: "/community" },
  { key: "upgrade-plan", title: "Upgrade your plan", body: "Unlock the AI Growth Engine, autonomous outreach, and advanced analytics with a paid tier.", link: "/subscriptions" },
  { key: "set-cashapp", title: "Add a Cash App tag", body: "Let supporters give with Cash App on any of your campaigns.", link: "/profile" },
];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const { user_id } = await req.json();
    if (!user_id) return Response.json({ error: 'Missing user_id' }, { status: 400 });

    const user = await sr.entities.User.get(user_id).catch(() => null);
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

    const [campaigns, connections, communityMemberships, institutions, volunteerSignups, applications] = await Promise.all([
      sr.entities.Campaign.filter({ created_by_id: user_id }, "-created_date", 100),
      sr.entities.PlatformConnection.filter({ created_by_id: user_id }, "-updated_date", 50),
      sr.entities.CommunityMember.filter({ user_id }, "-created_date", 50),
      sr.entities.Institution.filter({ created_by_id: user_id }, "-created_date", 50),
      sr.entities.VolunteerSignup.filter({ user_id }, "-created_date", 50),
      sr.entities.GrantApplication.filter({ applicant_user_id: user_id }, "-created_date", 50),
    ]);

    const hasCashApp = campaigns.some((c) => c.cashapp_tag);
    const used = {
      "connect-a-platform": connections.length > 0,
      "join-a-community": communityMemberships.length > 0,
      "invite-an-institution": institutions.length > 0 || applications.length > 0,
      "volunteer": volunteerSignups.length > 0,
      "upgrade-plan": effectiveSubscription(user).active,
      "set-cashapp": hasCashApp,
    };

    const unused = FEATURE_CHECKS.filter((f) => !used[f.key]);

    // Dedupe: skip features that already have an open Recommendation for this user.
    const existing = await sr.entities.Recommendation.filter({ owner_user_id: user_id, status: "open" }, "-created_date", 100);
    const existingTitles = new Set((existing || []).map((r) => r.title));
    const toCreate = unused.filter((f) => !existingTitles.has(f.title));

    let created = 0;
    for (const f of toCreate) {
      await sr.entities.Recommendation.create({
        owner_user_id: user_id,
        title: f.title,
        description: f.body,
        reasoning: "Discovered during an account feature scan — you haven't used this yet.",
        evidence: `feature:${f.key}`,
        agent: "growth",
        confidence: "medium",
        status: "open",
      });
      created++;
    }

    return Response.json({ ok: true, scanned: FEATURE_CHECKS.length, unused: unused.length, created });
  } catch (error) {
    console.error('discoverFeatures error:', error.message);
    return Response.json({ error: 'Unable to scan for features. Please try again.' }, { status: 500 });
  }
}