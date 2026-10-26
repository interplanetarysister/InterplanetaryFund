import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

// Joins or leaves a community. The membership record is written as the user so
// the author owns it under RLS, and the community's member_count is updated as
// the service role — Community.update is owner-only under RLS, so a joining
// member could not write the counter directly.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;

    const { action, community_id } = await req.json();
    if (!community_id) return Response.json({ error: 'Missing community_id' }, { status: 400 });

    const sr = base44.asServiceRole;
    const community = await sr.entities.Community.get(community_id).catch(() => null);
    if (!community) return Response.json({ error: 'Community not found' }, { status: 404 });

    if (action === 'leave') {
      const members = await sr.entities.CommunityMember.filter({ community_id, user_id: user.id });
      const m = members && members[0];
      if (!m) return Response.json({ error: 'You are not a member of this community.' }, { status: 400 });
      if (m.role === 'owner' || community.created_by_id === user.id) return Response.json({ error: 'The community owner cannot leave without transferring or closing the community first.' }, { status: 409 });
      await base44.entities.CommunityMember.delete(m.id);
      // Atomic decrement — avoids the read-modify-write race on concurrent
      // leaves. The member-existence check above prevents going below zero
      // in normal operation; one member leaving = one decrement.
      await sr.entities.Community.updateMany(
        { id: community_id },
        { $inc: { member_count: -1 } }
      );
      return Response.json({ ok: true });
    }

    // join (default)
    const existing = await sr.entities.CommunityMember.filter({ community_id, user_id: user.id });
    if (existing && existing.length) return Response.json({ error: 'You are already a member.' }, { status: 400 });
    await base44.entities.CommunityMember.create({
      community_id,
      user_id: user.id,
      user_name: user.full_name || user.username || user.handle || 'Interplanetary Fund member',
      role: 'member',
    });
    // Atomic increment — avoids the read-modify-write race on concurrent joins.
    await sr.entities.Community.updateMany(
      { id: community_id },
      { $inc: { member_count: 1 } }
    );
    return Response.json({ ok: true });
  } catch (error) {
    console.error('communityMembership error:', error?.name || 'UnknownError');
    return Response.json({ error: 'Unable to update your community membership. Please try again.' }, { status: 500 });
  }
}