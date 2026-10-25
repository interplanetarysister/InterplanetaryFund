import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { staticRecipe, orderedTransports } from '../../shared/platformConnectionRecipes.ts';

const OWNER_EMAILS = new Set(['cuddlemeplatonically@gmail.com','interplanetarysister@gmail.com']);
const TRANSPORTS = new Set(['oauth','api','webhook','token','authenticated_browser','public_browser','manual']);
const OPERATIONS = new Set(['connect','read_metrics','publish','account_create']);
const clean = (x: unknown) => String(x ?? '').trim().toLowerCase();
const fail = (error: string, status = 400) => Response.json({ok:false,error},{status,headers:{'Cache-Control':'no-store'}});
const nowISO = () => new Date().toISOString();

export default async function(req: Request) {
  try {
    const b = createClientFromRequest(req);
    const active = await assertActiveAccount(b);
    if (!active.ok) return fail(active.error, active.status);
    const user = active.user;
    // Role AND verified owner identity. This endpoint is never an agent's privilege.
    if (user.role !== 'admin' || !OWNER_EMAILS.has(clean(user.email)))
      return fail('Verified IFund owner required.',403);
    const body = await req.json().catch(() => ({}));
    const mode = clean(body.mode);
    const sr = b.asServiceRole;
    if (mode === 'prepare') {
      const platform = clean(body.platform), operation = clean(body.operation || 'connect');
      const transport = clean(body.transport);
      if (!/^[a-z][a-z0-9_]{0,79}$/.test(platform) || !OPERATIONS.has(operation) || !TRANSPORTS.has(transport))
        return fail('Unknown platform, operation or transport.');
      const recipe = staticRecipe(platform,operation);
      const rows = await sr.entities.PlatformConnectionRecipe.filter({platform,operation});
      if (!recipe && !rows.length) return fail('No registered recipe exists for this provider.',404);
      const existing = rows[0] || null;
      if (existing?.status === 'disabled' || existing?.blocked_routes?.includes(transport))
        return fail('This route is disabled or blocked.',409);
      const allowed = new Set(orderedTransports(existing || recipe));
      if (!allowed.has(transport)) return fail('Route is not among configured candidate methods.',409);
      // Only a route preference, not a proof of provider support, may be changed.
      const expires_at = new Date(Date.now()+10*60*1000).toISOString();
      const pending = await sr.entities.IntegrationChangeRequest.create({
        owner_user_id:user.id,platform,operation,transport,status:'pending',
        expected_recipe_version:Number(existing?.recipe_version || 0),
        created_at:nowISO(),expires_at,
      });
      return Response.json({ok:true,request_id:pending.id,status:'pending',
        expires_at,requires_owner_approval:true,
        preview:{platform,operation,previous_transport:existing?.preferred_transport || recipe?.preferred_transport || null,
          proposed_transport:transport,effect:'Change internal candidate route preference only; does not create an external account, grant scopes, or verify a provider.'}},
        {headers:{'Cache-Control':'no-store'}});
    }
    if (mode === 'status') {
      const id = String(body.request_id || '');
      if (!/^[a-zA-Z0-9_-]{8,120}$/.test(id)) return fail('Request ID required.');
      const pending = await sr.entities.IntegrationChangeRequest.get(id).catch(() => null);
      if (!pending || pending.owner_user_id !== user.id) return fail('Request not found.',404);
      return Response.json({ok:true,request_id:id,status:pending.status,
        platform:pending.platform,operation:pending.operation,transport:pending.transport,
        expires_at:pending.expires_at,result_summary:pending.result_summary || null},
        {headers:{'Cache-Control':'no-store'}});
    }
    if (mode === 'execute') {
      // Same conditional updateMany/CAS idiom already used for IFund external sync.
      // Never create a missing recipe here: concurrent insert uniqueness is unproven.
      const id = String(body.request_id || '');
      if (!/^[a-zA-Z0-9_-]{8,120}$/.test(id) || body.confirm !== true)
        return fail('Explicit owner confirmation and request ID required.');
      const pending = await sr.entities.IntegrationChangeRequest.get(id).catch(() => null);
      if (!pending || pending.owner_user_id !== user.id) return fail('Request not found.',404);
      if (pending.status !== 'pending') return fail('This request was already processed or is being processed.',409);
      if (!Number.isFinite(Date.parse(pending.expires_at)) || Date.parse(pending.expires_at) <= Date.now())
        return fail('Request expired. Prepare a new change.',409);
      const platform=clean(pending.platform), operation=clean(pending.operation), transport=clean(pending.transport);
      if (!/^[a-z][a-z0-9_]{0,79}$/.test(platform) || !OPERATIONS.has(operation) || !TRANSPORTS.has(transport))
        return fail('Prepared change is invalid.',409);
      const recipes = await sr.entities.PlatformConnectionRecipe.filter({platform,operation});
      if (!Array.isArray(recipes) || recipes.length !== 1)
        return fail('Exactly one configured provider recipe is required to apply changes safely.',409);
      const current = recipes[0];
      if (current.status === 'disabled' || current.blocked_routes?.includes(transport) ||
          !orderedTransports(current).includes(transport))
        return fail('Selected provider route is no longer available.',409);
      const version = Number(current.recipe_version);
      if (!Number.isSafeInteger(version) || version !== Number(pending.expected_recipe_version))
        return fail('Provider configuration changed. Prepare a new change.',409);
      const claimedAt = nowISO();
      const claimed = await sr.entities.IntegrationChangeRequest.updateMany({
        id, owner_user_id:user.id, status:'pending', expires_at:pending.expires_at,
        expected_recipe_version:pending.expected_recipe_version,
      },{$set:{status:'applying',approved_at:claimedAt}});
      if (Number(claimed?.updated) !== 1)
        return fail('This request was already claimed. Check its status.',409);
      try {
        const applied = await sr.entities.PlatformConnectionRecipe.updateMany({
          id:current.id,platform,operation,status:current.status,
          recipe_version:current.recipe_version,preferred_transport:current.preferred_transport,
        },{$set:{preferred_transport:transport,recipe_version:version+1,
          status:'probation',discovery_state:'probation'}});
        if (Number(applied?.updated) !== 1) {
          await sr.entities.IntegrationChangeRequest.updateMany(
            {id,owner_user_id:user.id,status:'applying'},
            {$set:{status:'rejected',result_summary:'Provider route changed before the update. Prepare again.'}});
          return fail('Provider route changed before the update. Prepare again.',409);
        }
        // Even if final audit update fails, status "applying" prevents replay.
        await sr.entities.IntegrationChangeRequest.updateMany(
          {id,owner_user_id:user.id,status:'applying'},
          {$set:{status:'applied',applied_at:nowISO(),
            result_summary:'Internal provider route preference updated; external connection remains unverified.'}});
        return Response.json({ok:true,status:'applied',request_id:id,platform,operation,
          verified_connection:false,external_provider_modified:false},
          {headers:{'Cache-Control':'no-store'}});
      } catch (error) {
        // Unknown outcome: fail closed. Do not clear the claimed state or retry a write.
        console.error('Owner configuration application result uncertain:',error instanceof Error?error.name:'UnknownError');
        return fail('Configuration result needs administrator review. Do not retry this approval.',503);
      }
    }
    return fail('Supported modes: prepare, status, execute.');
  } catch(error) {
    console.error('manageOwnerConnectionConfiguration:',error instanceof Error?error.name:'UnknownError');
    return fail('Unable to process configuration change.',500);
  }
}
