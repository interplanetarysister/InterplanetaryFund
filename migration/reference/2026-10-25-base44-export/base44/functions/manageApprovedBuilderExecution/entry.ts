import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { logAudit } from '../../shared/auditLog.ts';
import { builderConfiguration, submitApprovedBuilderTurn, checkBuilderAppState, publishApprovedBuild } from '../../shared/approvedBuilderBridge.ts';

// Only this protected function can resume an approved real builder job,
// check its coarse platform status or approve a separate release.
const OWNER_EMAILS=new Set(['cuddlemeplatonically@gmail.com','interplanetarysister@gmail.com']);
const isOwner=(u:any)=>u?.role==='admin'&&OWNER_EMAILS.has(String(u?.email||'').trim().toLowerCase());
const safe=(v:unknown,n=180)=>String(v??'').trim().slice(0,n);
const read=(p:any)=>({
  id:p.id,task_id:p.builder_task_id,status:p.status,
  execution_state:p.builder_execution_state||'queued',dispatch_error:p.dispatch_error||'',
  provider_phase:p.builder_provider_phase||'',last_checked_at:p.builder_last_checked_at||'',
  review_evidence:p.builder_review_evidence||'',release_at:p.builder_release_approval_at||'',
  verification_evidence:p.verification_evidence||'',
});
export default async function(req:Request){
  try{
    const base44=createClientFromRequest(req);
    const guard=await assertActiveAccount(base44);
    if(!guard.ok)return Response.json({error:guard.error},{status:guard.status});
    const actor=guard.user;
    if(!isOwner(actor))return Response.json({error:'Super-admin only'},{status:403});
    const sr=base44.asServiceRole;
    const body=await req.json().catch(()=>({}));
    const mode=safe(body.mode,32);
    const config=builderConfiguration();
    const releaseEnabled=Deno.env.get('IFUND_BUILDER_RELEASE_ENABLED')==='true';
    if(mode==='readiness'){
      return Response.json({ok:true,configured:config.configured,credits_enabled:config.credits,
        can_start:config.enabled,release_enabled:releaseEnabled});
    }
    const id=safe(body.incident_id,96);
    if(!id)return Response.json({error:'Incident ID required'},{status:400});
    const incident=await sr.entities.PlatformIncident.get(id).catch(()=>null);
    if(!incident||!incident.builder_task_id||!incident.approved_by_user_id)
      return Response.json({error:'No approved builder assignment for that incident'},{status:404});
    const task=await sr.entities.AgentDelegation.get(incident.builder_task_id).catch(()=>null);
    if(!task||task.destination_agent!=='admin_builder_agent'||task.source_agent!=='platform_incident_audit')
      return Response.json({error:'Builder assignment failed authorization checks'},{status:409});
    if(mode==='view')return Response.json({ok:true,job:read(incident),can_start:config.enabled});

    if(mode==='start'){
      const state=incident.builder_execution_state||'queued';
      if(!['queued','blocked_credits','blocked_config','failed'].includes(state))
        return Response.json({error:'Builder submission already started or cannot be safely retried. Review status first.',job:read(incident)},{status:409});
      if(!config.enabled)return Response.json({
        ok:true,started:false,reason:config.configured?'Builder credits are disabled':'Builder connection needs server configuration',
        job:read(incident)
      });
      if(Number(incident.builder_attempts||0)>=2)
        return Response.json({error:'Manual reconciliation is required after multiple attempts.'},{status:409});
      await sr.entities.PlatformIncident.update(id,{
        builder_execution_state:'submitting',
        builder_attempts:Number(incident.builder_attempts||0)+1,
        dispatch_error:'',
      });
      try{
        const response=await submitApprovedBuilderTurn(incident,task.id);
        await sr.entities.PlatformIncident.update(id,{status:'builder_dispatched',
          builder_execution_state:'submitted',builder_request_ref:response.request_ref,
          builder_last_checked_at:new Date().toISOString(),dispatch_error:''});
        await sr.entities.AgentDelegation.update(task.id,{status:'in_progress',
          result_summary:'Approved Base44 builder change turn submitted; source validation pending.',
          updated_at:new Date().toISOString()});
        await logAudit(base44,{action:'approved_builder_turn_submitted',actor_user_id:actor.id,
          target_type:'PlatformIncident',target_id:id,status:'success'});
        return Response.json({ok:true,started:true,job:{...read(incident),execution_state:'submitted'}});
      }catch(error){
        const reason=safe(error instanceof Error?error.message:'builder_unknown_failure',100);
        const definitelyRejected=['builder_configuration_missing','builder_credits_disabled',
          'builder_authorization_failed','builder_workspace_access_denied',
          'builder_credits_or_rate_limited','builder_request_rejected'].includes(reason);
        await sr.entities.PlatformIncident.update(id,{
          status:'approved_queued',
          builder_execution_state:definitelyRejected?'failed':'failed_uncertain',
          dispatch_error:reason
        });
        return Response.json({ok:false,error:definitelyRejected?'Builder request was rejected.':'Builder request outcome is uncertain; do not retry without checking Base44.',
          execution_state:definitelyRejected?'failed':'failed_uncertain'},{status:502});
      }
    }

    if(mode==='check'){
      if(!['submitted','review_required','released_unverified'].includes(incident.builder_execution_state))
        return Response.json({ok:true,job:read(incident),note:'No submitted builder operation to check.'});
      if(!config.enabled)return Response.json({ok:true,job:read(incident),note:'Builder status checking is unavailable until authorization and credits are enabled.'});
      try{
        const state=await checkBuilderAppState();
        const now=new Date().toISOString();
        await sr.entities.PlatformIncident.update(id,{
          builder_provider_phase:state.phase,builder_last_checked_at:now
        });
        return Response.json({ok:true,job:{...read(incident),provider_phase:state.phase,last_checked_at:now},
          verified_source:false,verified_deployed:false});
      }catch{
        return Response.json({ok:false,error:'Builder status could not be confirmed; no changes to release status.',job:read(incident)},{status:502});
      }
    }

    if(mode==='record_review'){
      if(!['submitted','review_required'].includes(incident.builder_execution_state))
        return Response.json({error:'Builder changes have not been submitted for review'},{status:409});
      const revision=safe(body.revision,100), tests=safe(body.tests,2000);
      if(!/^[a-f0-9]{7,64}$/i.test(revision)||tests.length<25)
        return Response.json({error:'Supply the actual source revision/commit and regression test evidence'},{status:400});
      const evidence='Admin-reviewed source revision '+revision+'; tests: '+tests;
      await sr.entities.PlatformIncident.update(id,{
        builder_execution_state:'review_required',builder_review_evidence:evidence,
      });
      await logAudit(base44,{action:'builder_change_review_recorded',actor_user_id:actor.id,
        target_type:'PlatformIncident',target_id:id,status:'success',
        detail:'Source revision '+revision+' reviewed; release still requires separate approval'});
      return Response.json({ok:true,job:{...read(incident),execution_state:'review_required',review_evidence:evidence},released:false});
    }
    if(mode==='release'){
      if(incident.builder_execution_state!=='review_required'||!incident.builder_review_evidence)
        return Response.json({error:'Record the actual source revision and test evidence before release'},{status:409});
      if(body.confirm_release!==true||body.confirm_entire_current_app!==true)
        return Response.json({error:'Explicit release confirmation is required for the entire current app state, including unrelated pending changes.'},{status:400});
      if(!config.enabled||!releaseEnabled)return Response.json({
        ok:true,released:false,reason:'Release blocked by backend credit or deployment setting.',
        job:read(incident)
      });
      await sr.entities.PlatformIncident.update(id,{builder_execution_state:'release_submitting',
        builder_release_approval_by:actor.id,builder_release_approval_at:new Date().toISOString()});
      try{
        const response=await publishApprovedBuild();
        await sr.entities.PlatformIncident.update(id,{builder_execution_state:'released_unverified',
          status:'implementation_pending',builder_provider_phase:response.provider_status});
        await sr.entities.AgentDelegation.update(task.id,{
          status:'needs_review',result_summary:'Release request submitted; independent live regression checks still required.',
          updated_at:new Date().toISOString()
        });
        await logAudit(base44,{action:'builder_release_submitted',actor_user_id:actor.id,
          target_type:'PlatformIncident',target_id:id,status:'success'});
        return Response.json({ok:true,released:true,verified:false,provider_status:response.provider_status});
      }catch{
        await sr.entities.PlatformIncident.update(id,{builder_execution_state:'release_failed',
          dispatch_error:'Release result is uncertain. Check Base44 before repeating.'});
        return Response.json({ok:false,error:'Release outcome could not be confirmed; check Base44 deployment history.'},{status:502});
      }
    }
    if(mode==='verify_live'){
      if(incident.builder_execution_state!=='released_unverified')
        return Response.json({error:'A released build is required before live verification'},{status:409});
      const evidence=safe(body.live_evidence,2000);
      if(evidence.length<35)return Response.json({error:'Provide dated end-to-end live test evidence before closure'},{status:400});
      await sr.entities.PlatformIncident.update(id,{
        status:'verified_fixed',builder_execution_state:'verified',
        verification_evidence:evidence,verified_at:new Date().toISOString()
      });
      await sr.entities.AgentDelegation.update(task.id,{status:'completed',
        verification:evidence.slice(0,1200),result_summary:'Super-admin recorded live release test evidence.',
        completed_at:new Date().toISOString(),updated_at:new Date().toISOString()});
      await logAudit(base44,{action:'builder_fix_verified_live',actor_user_id:actor.id,
        target_type:'PlatformIncident',target_id:id,status:'success'});
      return Response.json({ok:true,verified:true});
    }
    return Response.json({error:'Unsupported action'},{status:400});
  }catch(error){
    console.error('manageApprovedBuilderExecution:',error instanceof Error?error.name:'Error');
    return Response.json({error:'Builder operation failed safely'},{status:500});
  }
}
