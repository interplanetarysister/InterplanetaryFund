import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { logAudit } from '../../shared/auditLog.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    if (body.confirm !== true || !body.authorization_id) return Response.json({ error: 'Explicit withdrawal authorization is required.' }, { status: 400 });
    const sr = base44.asServiceRole;
    const auth = await sr.entities.ExternalCollectionAuthorization.get(body.authorization_id).catch(() => null);
    if (!auth || auth.owner_user_id !== user.id) return Response.json({ error: 'Collection authorization not found.' }, { status: 404 });
    if (auth.status !== 'prepared') return Response.json({ error: 'This collection authorization is no longer awaiting confirmation.' }, { status: 409 });
    if (!auth.expires_at || new Date(auth.expires_at).getTime() <= Date.now()) {
      await sr.entities.ExternalCollectionAuthorization.update(auth.id, { status: 'expired' });
      return Response.json({ error: 'This collection authorization expired. Refresh balances and try again.' }, { status: 409 });
    }
    const authorizedAt = new Date().toISOString();
    await sr.entities.ExternalCollectionAuthorization.update(auth.id, { status: 'authorized', authorized_at: authorizedAt });
    await logAudit(base44, { action: 'collect_withdraw_authorized', actor_user_id: user.id, target_type: 'ExternalCollectionAuthorization', target_id: auth.id, detail: 'Owner explicitly authorized the listed external collection sources. No unsupported provider transfer was represented as complete.', status: 'success', metadata: { operation_id: auth.operation_id, campaign_id: auth.campaign_id } });
    return Response.json({ ok: true, authorization_id: auth.id, operation_id: auth.operation_id, status: 'authorized', authorized_at: authorizedAt,
      next_step: 'Execute only provider-supported transfer adapters; sources requiring provider confirmation must pause for user action.' });
  } catch (error) {
    console.error('authorizeCollectAndWithdraw failed:', error?.message || error);
    return Response.json({ error: 'Could not authorize connected-platform collection.' }, { status: 500 });
  }
}