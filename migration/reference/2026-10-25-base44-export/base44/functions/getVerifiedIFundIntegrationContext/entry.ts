import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { OAUTH_ENV } from '../../shared/connectionVerification.ts';
import { staticRecipe, orderedTransports, requiresRouteRediscovery } from '../../shared/platformConnectionRecipes.ts';

// Read-only, redacted integration configuration for connection agents.
// This endpoint deliberately does NOT authorize provider mutations or reveal secrets.
const OWNER_EMAILS = new Set(['cuddlemeplatonically@gmail.com', 'interplanetarysister@gmail.com']);
const clean = (value: unknown, max = 80) => String(value ?? '').trim().toLowerCase().slice(0, max);
const validPlatform = (value: string) => /^[a-z][a-z0-9_]{0,79}$/.test(value);
export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const platform = clean(body.platform);
    if (!validPlatform(platform)) return Response.json({ error: 'A valid platform is required.' }, { status: 400 });
    const subject = body.subject === 'platform_owner' ? 'platform_owner' : 'member';
    const isOwner = user.role === 'admin' && OWNER_EMAILS.has(clean(user.email, 200));
    if (subject === 'platform_owner' && !isOwner)
      return Response.json({ error: 'Platform-owner access is restricted.' }, { status: 403 });

    const sr = base44.asServiceRole;
    const stored = await sr.entities.PlatformConnectionRecipe.filter({ platform, operation: 'connect' }).catch(() => null);
    const storedRead = await sr.entities.PlatformConnectionRecipe.filter({ platform, operation: 'read_metrics' }).catch(() => null);
    const selected = Array.isArray(stored) && stored.length ? stored[0]
      : Array.isArray(storedRead) && storedRead.length ? storedRead[0] : null;
    const disabled = selected?.status === 'disabled';
    const recipe = disabled ? null : selected ||
      staticRecipe(platform, 'connect') || staticRecipe(platform, 'read_metrics');
    const transports = recipe ? orderedTransports(recipe).filter((t: string) => t !== 'manual') : [];
    const envKey = OAUTH_ENV[platform];
    const registrationReferencePresent = !!(envKey && Deno.env.get(envKey));
    // A registration environment variable is not proof that OAuth works.
    const gatheredAt = new Date().toISOString();
    return Response.json({
      ok: true, read_only: true, subject, platform,
      actor_user_id: user.id,
      collected_at: gatheredAt,
      config_freshness: 'runtime_snapshot',
      authoritative_sources: ['authenticated_account', 'deployed_connection_recipes', 'runtime_registration_presence'],
      // Never turn a guessed URL or remembered email into provider-registration data.
      branding: { application_name: 'Interplanetary Fund', verification: 'source_config_only' },
      external_provider_registration: {
        registration_reference_present: registrationReferencePresent,
        registration_verified: false,
        oauth_authorization_verified: false,
      },
      connection_method: {
        route_disabled: disabled,
        persisted_recipe_available: !!selected,
        candidates: transports,
        rediscovery_required: requiresRouteRediscovery(recipe, transports),
        provider_policy_verified: false,
        browser_workflow_available: false,
      },
      owner_delegation: {
        eligible_owner_identity: subject === 'platform_owner' && isOwner,
        config_mutation_authorized: false,
        requires_separate_server_checked_grant: true,
        sensitive_changes_require_fresh_owner_approval: true,
      },
      unknown_fields: ['verified_production_origin', 'oauth_redirect_uris', 'provider_app_id',
        'approved_support_contact', 'provider_policy', 'allowed_capabilities'],
      note: 'Readiness requires provider verification. This response grants no write access.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('getVerifiedIFundIntegrationContext:', error instanceof Error ? error.name : 'Error');
    return Response.json({ error: 'Could not load verified integration context.' }, { status: 500 });
  }
}
