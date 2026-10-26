import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { resolveCapabilities, REGISTRY_VERSION } from '../../shared/providerCapabilities.ts';

// Canonical provider-capability listing. Delegates to the shared resolver so
// the UI and financial execution see the same capability interpretation.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error:'Unauthorized' }, { status:401 });
    const sr = base44.asServiceRole;
    const providers = await resolveCapabilities(sr);
    return Response.json({ providers, registry_version: REGISTRY_VERSION });
  } catch (error) {
    console.error('listFundraisingProviderCapabilities failed:', error?.name || 'UnknownError');
    return Response.json({ error:'Could not load fundraising provider capabilities.' }, { status:500 });
  }
}