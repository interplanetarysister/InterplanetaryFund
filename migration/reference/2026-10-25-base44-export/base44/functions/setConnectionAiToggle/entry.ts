import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { hasUnifiedOboConsent } from '../../shared/integrationRegistry.ts';
import { restrictedAgentScope } from '../../shared/aiConnectionScope.ts';

// Single per-platform on/off. Never modifies the selected scope or touches
// provider OAuth credentials. Only the owner can change its own permission.
export default async function(req: Request) {
  try {
    if (req.method !== 'POST') return Response.json({error:'Method not allowed'},{status:405});
    const api=createClientFromRequest(req), guard=await assertActiveAccount(api);
    if(!guard.ok) return Response.json({error:guard.error},{status:guard.status});
    const user=guard.user;
    const body=await req.json().catch(()=>({}));
    if(typeof body.enabled!=='boolean' || !body.connection_id)
      return Response.json({error:'Choose AI on or off for this connection.'},{status:400});
    if(body.enabled && !hasUnifiedOboConsent(user))
      return Response.json({error:'Turn on the IFund-wide AI switch first.'},{status:403});
    const visible=await api.entities.PlatformConnection.get(String(body.connection_id)).catch(()=>null);
    if(!visible || visible.created_by_id!==user.id)
      return Response.json({error:'Connection not found.'},{status:404});
    const full=await api.asServiceRole.entities.PlatformConnection.get(visible.id);
    if(!full || full.created_by_id!==user.id)
      return Response.json({error:'Connection not found.'},{status:404});
    const now=new Date().toISOString();
    const previous=full.obo_consent || {};
    const requested=Array.isArray(previous.requested_capabilities) ? previous.requested_capabilities : [];
    if(body.enabled && !requested.length)
      return Response.json({error:'Reconnect and select an AI permission scope first.'},{status:409});
    const eligible=full.status==='connected' && full.verification_status==='verified';
    const effective=body.enabled ? restrictedAgentScope(requested,previous.provider_capabilities || []) : [];
    const version=String(user.ai_obo_consent?.permission_version || '');
    const updated=await api.asServiceRole.entities.PlatformConnection.update(full.id,{
      automation_mode:body.enabled?'auto':'manual',
      obo_consent:{...previous,
        granted:body.enabled,opted_out:!body.enabled,revoked_at:body.enabled?null:now,
        granted_at:body.enabled?(previous.granted_at || now):null,
        permission_version:version,granted_capabilities:effective},
      agent_access:{...(full.agent_access || {}),
        shared_with_agents:body.enabled,automation_enabled:body.enabled && eligible &&
          effective.includes('create_post')},
      history:[...(full.history||[]),{at:now,event:body.enabled?'ai_permission_enabled':'ai_permission_revoked',
        detail:'Owner changed the AI access switch for this account.'}].slice(-30)
    });
    return Response.json({ok:true,connection_id:updated.id,ai_authorized:body.enabled,
      automation_enabled:updated.agent_access?.automation_enabled===true});
  } catch(e) {
    console.error('setConnectionAiToggle:',e instanceof Error?e.name:'Error');
    return Response.json({error:'Could not change AI access.'},{status:500});
  }
}
