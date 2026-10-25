import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

const STATUSES = new Set(['approved', 'rejected']);

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const activityId = String(body?.activity_id || '').trim();
    const status = String(body?.status || '').trim();
    if (!activityId || !STATUSES.has(status)) return Response.json({ error: 'Invalid review request' }, { status: 400 });
    const rows = await base44.asServiceRole.entities.AgentActivity.filter({ id: activityId });
    const activity = rows?.[0];
    if (!activity) return Response.json({ error: 'Activity not found' }, { status: 404 });
    if (activity.owner_user_id !== user.id && user.role !== 'admin') return Response.json({ error: 'Not authorized' }, { status: 403 });
    if (activity.status !== 'pending') return Response.json({ error: 'Activity is no longer pending' }, { status: 409 });
    await base44.asServiceRole.entities.AgentActivity.update(activityId, { status });
    return Response.json({ ok: true, activity_id: activityId, status });
  } catch (error) {
    console.error('reviewAgentActivity failed:', error?.name || 'UnknownError');
    return Response.json({ error: 'Agent activity review could not be completed safely.' }, { status: 500 });
  }
}
