import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { OAUTH_ENV } from '../../shared/connectionVerification.ts';

// Admin-only configuration audit. A saved connector ID is not proof that
// Microsoft, Meta, Google, or another provider can authorize an actual user.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    if (guard.user?.role !== 'admin') {
      return Response.json({ error: 'Administrator access required.' }, { status: 403 });
    }
    if (req.method !== 'POST') return Response.json({ error: 'POST required.' }, { status: 405 });

    const unique = new Map();
    for (const [platform, envName] of Object.entries(OAUTH_ENV)) {
      const existing = unique.get(envName);
      if (existing) {
        existing.platforms.push(platform);
      } else {
        unique.set(envName, {
          platforms: [platform],
          env_key: envName,
          registration_reference_present: !!String(Deno.env.get(envName) || '').trim(),
        });
      }
    }

    const entries = [...unique.values()].sort((a, b) => a.platforms[0].localeCompare(b.platforms[0]));
    const withReference = entries.filter(e => e.registration_reference_present).length;
    return Response.json({
      status: 'configuration_inventory',
      warning: 'A registration reference does not prove OAuth sign-in, granted scope, provider verification or publishing ability.',
      expected: entries.length,
      registration_references_present: withReference,
      missing: entries.length - withReference,
      entries,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    console.error('adminOAuthProviderReadiness:', e?.name || 'UnknownError');
    return Response.json({ error: 'IFund could not check provider setup.' }, { status: 500 });
  }
}