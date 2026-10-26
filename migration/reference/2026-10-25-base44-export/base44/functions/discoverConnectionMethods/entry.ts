import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { OAUTH_ENV } from '../../shared/connectionVerification.ts';
import { staticRecipe, orderedTransports, requiresRouteRediscovery } from '../../shared/platformConnectionRecipes.ts';

// Read-only connection discovery. No passwords, browser state or secret values are returned.
// It does not issue OAuth URLs, provision credentials or authorize external changes.
const clean = (value: unknown) => String(value ?? '').trim().toLowerCase().slice(0,80);
const OWNER_EMAILS = new Set(['cuddlemeplatonically@gmail.com','interplanetarysister@gmail.com']);
const permitted = new Set(['oauth','api','webhook','token','authenticated_browser','public_browser','manual']);
export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({error:guard.error},{status:guard.status});
    const user = guard.user;
    const input = await req.json().catch(() => ({}));
    const platform = clean(input.platform);
    const operation = clean(input.operation || 'connect');
    const subject = input.subject === 'platform_owner' ? 'platform_owner' : 'member';
    if (!/^[a-z][a-z0-9_]{0,79}$/.test(platform) ||
        !['connect','read_metrics','publish','account_create'].includes(operation))
      return Response.json({error:'A supported platform operation is required.'},{status:400});
    if (subject === 'platform_owner' &&
       !(user.role === 'admin' && OWNER_EMAILS.has(clean(user.email))))
      return Response.json({error:'Platform owner access is restricted.'},{status:403});

    // Recipes are routing candidates, NOT evidence of approval or working operations.
    const rows = await base44.asServiceRole.entities.PlatformConnectionRecipe
      .filter({platform,operation}).catch(() => null);
    const seeded = staticRecipe(platform,operation) ||
      (operation === 'connect' ? staticRecipe(platform,'read_metrics') : null);
    const saved = Array.isArray(rows) ? rows.find((r:any) => r?.status !== 'disabled') : null;
    const recipe = saved || (Array.isArray(rows) && rows.some((r:any)=>r?.status === 'disabled')
      ? null : seeded);
    const candidates = recipe ? orderedTransports(recipe).filter((t:string)=>permitted.has(t)) : [];
    const env = OAUTH_ENV[platform];
    const registrationPresent = !!(env && Deno.env.get(env));
    const methods = candidates.map((transport:string) => ({
      method:transport,
      requires_user_developer_credentials: transport === 'api' || transport === 'token' || transport === 'webhook',
      can_attempt: transport === 'oauth' ? registrationPresent : transport === 'public_browser',
      verified: false,
      requires_human_interaction: ['oauth','authenticated_browser','manual'].includes(transport),
      note: transport === 'authenticated_browser'
        ? 'Requires an approved isolated browser runner; not enabled by this endpoint.'
        : transport === 'public_browser'
          ? 'Public-link access is not account authorization.'
          : transport === 'oauth'
            ? 'User signs in to the provider. Registration presence does not prove permission.'
            : 'Requires provider-specific validation before use.',
    }));
    return Response.json({
      ok:true,subject,platform,operation,source: saved?'persisted_recipe':seeded?'static_recipe':'none',
      route_data_available:Array.isArray(rows),
      registration_reference_present:registrationPresent,
      connection_verified:false,
      provider_policy_verified:false,
      rediscovery_required:requiresRouteRediscovery(recipe,candidates),
      methods,
      next_step:methods.some((m:any)=>m.method==='oauth'&&m.can_attempt)
        ? 'Open the configured IFund OAuth connection flow and verify capabilities after provider consent.'
        : methods.some((m:any)=>m.method==='public_browser')
          ? 'Ask for a public campaign URL and verify only the public link.'
          : 'Administrator must verify and configure a provider-permitted connection route.',
    },{headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    console.error('discoverConnectionMethods:',error instanceof Error?error.name:'UnknownError');
    return Response.json({error:'Connection discovery is unavailable.'},{status:500});
  }
}
