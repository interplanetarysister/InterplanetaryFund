import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { FEATURE_SCOPES } from '../../shared/featureFlagGate.ts';
import { probeLiveProviders, liveFeatureSnapshot } from '../../shared/liveProviderReadiness.ts';

export default async function(req: Request) {
  try {
    const client = createClientFromRequest(req);
    const guard = await assertActiveAccount(client);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    if (guard.user.role !== 'admin') return Response.json({ error: 'Administrator only' }, { status: 403 });
    const [providers, flags, registry] = await Promise.all([
      probeLiveProviders(),
      client.asServiceRole.entities.FeatureFlag.list('-created_date', 200),
      client.asServiceRole.entities.PlatformAccessRegistry.list('-platform', 200).catch(() => []),
    ]);
    const connections = (registry || []).map((row: any) => ({
      platform: String(row.platform || ''),
      state: String(row.status || 'DISCONNECTED'),
      checked_at: String(row.last_verified || ''),
      live_verified: row.status === 'ACTIVE' && !!row.last_successful_verification &&
        Number.isFinite(Date.parse(row.last_successful_verification)) &&
        Date.now() - Date.parse(row.last_successful_verification) < 86400000,
    }));
    return Response.json({ ok: true, providers, features: Object.keys(FEATURE_SCOPES).map(k => liveFeatureSnapshot(k, flags || [], providers, registry || [])), connections, checked_at: new Date().toISOString() }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    console.error('getLiveProviderStatus failed:', e?.name || 'UnknownError');
    return Response.json({ error: 'Provider status unavailable' }, { status: 503 });
  }
}
