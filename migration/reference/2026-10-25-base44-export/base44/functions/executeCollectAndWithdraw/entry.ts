import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { logAudit } from '../../shared/auditLog.ts';
import { resolveCapabilityMap } from '../../shared/providerCapabilities.ts';

// Executes only transfer paths that IFund has independently verified as
// executable. Configuration-based/direct payout models are coordinated here but
// never recorded as settled money until provider settlement is verified.
export default async function(req) {
  try {
    const base44=createClientFromRequest(req); const activeAccount = await assertActiveAccount(base44); if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user=await base44.auth.me().catch(()=>null);
    if(!user) return Response.json({error:'Unauthorized'},{status:401});
    const body=await req.json().catch(()=>({}));
    const sr=base44.asServiceRole;
    const authorization=await sr.entities.ExternalCollectionAuthorization.get(body.authorization_id).catch(()=>null);
    if(!authorization||authorization.owner_user_id!==user.id) return Response.json({error:'Collection authorization not found.'},{status:404});
    if(authorization.status!=='authorized') return Response.json({error:'Explicit collection authorization is required before execution.'},{status:409});
    if(!authorization.authorized_at) return Response.json({error:'Authorization timestamp is missing.'},{status:409});
    // Authorization snapshot integrity: an expired authorization must not be
    // executed even if its status was not yet transitioned. The user must
    // refresh balances and re-authorize.
    if(authorization.expires_at && new Date(authorization.expires_at).getTime() <= Date.now()) {
      await sr.entities.ExternalCollectionAuthorization.update(authorization.id,{status:'expired'});
      return Response.json({error:'This collection authorization has expired. Refresh balances and re-authorize.'},{status:409});
    }

    const byPlatform=await resolveCapabilityMap(sr);
    const results=[];
    for(const source of authorization.sources||[]) {
      const cap=byPlatform.get(String(source.platform||'').toLowerCase());
      if(source.status!=='ready_for_authorization') { results.push({...source,status:'user_action_required'}); continue; }
      if(!cap||cap.capability_status!=='verified') {
        results.push({...source,status:'user_action_required',note:'Provider payout capability is not verified for automated collection.'}); continue;
      }
      if(cap.api_transfer===true) {
        // No provider is enabled here until a provider-specific transfer adapter
        // is implemented and verified. Never turn a registry flag into money movement.
        results.push({...source,status:'adapter_required',note:'Verified API-transfer capability requires its provider-specific idempotent transfer adapter.'}); continue;
      }
      if(cap.payout_model==='direct_to_connected_account') {
        results.push({...source,status:'awaiting_settlement',note:'Funds route through the connected payout account. IFund will count them only after settlement is independently verified.'}); continue;
      }
      if(cap.payout_model==='automatic_payout') {
        results.push({...source,status:'provider_schedule_active',note:'Provider automatic payout is the supported route. Settlement must be verified before funds become IFund-withdrawable.'}); continue;
      }
      results.push({...source,status:'user_action_required',note:'This provider requires a user/provider-controlled payout step.'});
    }
    const hasAction=results.some(r=>['user_action_required','adapter_required'].includes(r.status));
    const hasPending=results.some(r=>['awaiting_settlement','provider_schedule_active'].includes(r.status));
    const status=hasAction?'user_action_required':hasPending?'processing':'processing';
    await sr.entities.ExternalCollectionAuthorization.update(authorization.id,{status,sources:results});
    await logAudit(base44,{action:'collect_withdraw_execution_planned',actor_user_id:user.id,target_type:'ExternalCollectionAuthorization',target_id:authorization.id,detail:'Executed verified collection routing without treating unsettled external balances as IFund-held money.',status:'success',metadata:{operation_id:authorization.operation_id,status}});
    return Response.json({ok:true,authorization_id:authorization.id,operation_id:authorization.operation_id,status,sources:results,settled_amount:0,withdrawable_imported:0});
  } catch(error) {
    console.error('executeCollectAndWithdraw failed:',error?.message||error);
    return Response.json({error:'Connected-platform collection could not continue safely.'},{status:500});
  }
}