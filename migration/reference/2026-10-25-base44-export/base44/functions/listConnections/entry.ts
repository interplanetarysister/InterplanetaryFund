import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { redactCredentials } from '../../shared/integrationRegistry.ts';

// Returns the caller's PlatformConnection records with secret credential
// values redacted (blanked) and a credentials_meta map indicating which secrets
// are set. RLS already scopes reads to the owner (or all, for admins); this
// layer ensures raw Bluesky/Mastodon/Ko-fi secrets never reach frontend state.
// Non-secret identifiers (handles, instances) are kept so the edit form works.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { scope } = await req.json().catch(() => ({}));
    // Admins can inspect every account only from the dedicated admin view.
    // The personal Connections page always sees the caller's own records.
    const list = scope === 'all' && user.role === 'admin'
      ? await base44.asServiceRole.entities.PlatformConnection.list('-updated_date', 300)
      : await base44.entities.PlatformConnection.filter({ created_by_id: user.id }, '-updated_date', 300);
    const connections = list.map((c) => {
      const { credentials, credentials_meta } = redactCredentials(c.credentials);
      return { ...c, credentials, credentials_meta };
    });
    return Response.json({ connections });
  } catch (error) {
    console.error('listConnections error:', error.message);
    return Response.json({ error: 'Could not load connections.' }, { status: 500 });
  }
}