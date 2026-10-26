import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { campaignForResponse } from '../../shared/campaignResponse.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const body = await req.json().catch(() => ({}));
    const id = String(body?.campaign_id || '').trim();
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return Response.json({ error: 'Invalid campaign ID' }, { status: 400 });
    const rows = await base44.asServiceRole.entities.Campaign.filter({ id });
    const draft = rows?.[0];
    if (!draft || draft.status !== 'draft') return Response.json({ error: 'Draft not found' }, { status: 404 });
    if (draft.created_by_id !== guard.user.id && guard.user.role !== 'admin')
      return Response.json({ error: 'Not authorized' }, { status: 403 });
    return Response.json({ ok: true, campaign: campaignForResponse(draft) });
  } catch {
    return Response.json({ error: 'Could not load draft' }, { status: 500 });
  }
}
