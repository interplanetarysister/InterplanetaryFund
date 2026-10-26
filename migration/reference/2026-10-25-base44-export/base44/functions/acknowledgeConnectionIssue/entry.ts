import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const id = String(body?.connection_id || '').trim();
    if (!id) return Response.json({ error: 'Connection id required' }, { status: 400 });
    const rows = await base44.asServiceRole.entities.PlatformConnection.filter({ id });
    const connection = rows?.[0];
    if (!connection) return Response.json({ error: 'Connection not found' }, { status: 404 });
    const history = Array.isArray(connection.history) ? connection.history : [];
    await base44.asServiceRole.entities.PlatformConnection.update(id, {
      history: [...history, {
        at: new Date().toISOString(),
        event: 'admin_acknowledged',
        detail: 'Admin acknowledged the connection issue; provider verification remains required.',
      }].slice(-30),
    });
    return Response.json({ ok: true, connection_id: id });
  } catch (error) {
    console.error('acknowledgeConnectionIssue failed:', error?.name || 'UnknownError');
    return Response.json({ error: 'Connection issue could not be acknowledged safely.' }, { status: 500 });
  }
}
