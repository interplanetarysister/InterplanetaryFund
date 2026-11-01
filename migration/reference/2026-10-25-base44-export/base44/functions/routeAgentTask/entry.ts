import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { hasSubscriptionLevel,hasManagedConnections } from '../../shared/subscriptionEntitlements.ts';
import { logAudit } from '../../shared/auditLog.ts';

// Controlled, owner-scoped specialist dispatch. A handoff is a real Base44
// agent conversation, not merely a status message or an unprocessed queue item.
// Never dispatch to admin_builder_agent or infer capability from prose alone.
const SPECIALISTS:Record<string,string>={
  strategy:'strategy_agent', planning:'strategy_agent',
  growth:'growth_agent', analytics:'growth_agent',
  communications:'communications_agent', messages:'communications_agent',
  writing:'story_agent', story:'story_agent',
  finance:'finance_agent', donations:'finance_agent',
  outreach:'outreach_agent', publishing:'outreach_agent',
  connections:'managed_connection_agent', connection_repair:'managed_connection_agent',
  discovery:'connection_discovery_agent', research:'connection_discovery_agent',
};
const TARGETS=new Set(['chief_of_staff',...Object.values(SPECIALISTS)]);
const trim=(v:any,n=500)=>String(v??'').trim().slice(0,n);
const live=new Set(['requested','assigned','in_progress','waiting_user','waiting_external','needs_review']);
const publicItem=(d:any)=>({
  id:d.id,status:d.status,source_agent:d.source_agent,
  destination_agent:d.destination_agent,objective:d.objective,
  result_summary:d.result_summary||'',verification:d.verification||'',
  updated_at:d.updated_at||'',conversation_id:d.continuation_state?.continuation_ref||'',
});
export default async function(req:Request) {
  try{
    const base44=createClientFromRequest(req);
    const guard=await assertActiveAccount(base44);
    if(!guard.ok)return Response.json({error:guard.error},{status:guard.status});
    const user=guard.user,sr=base44.asServiceRole;
    if(!hasSubscriptionLevel(user,1))return Response.json({error:'An AI subscription is required.'},{status:403});
    const body=await req.json().catch(()=>({}));
    const mode=trim(body.mode||'dispatch',20);
    if(mode==='status'){
      const id=trim(body.delegation_id,100);
      const d=await sr.entities.AgentDelegation.get(id).catch(()=>null);
      if(!d||d.owner_user_id!==user.id)return Response.json({error:'Handoff not found'},{status:404});
      if(d.status!=='in_progress')return Response.json({ok:true,handoff:publicItem(d)});
      const cid=trim(d.continuation_state?.continuation_ref,130);
      if(!cid)return Response.json({ok:true,handoff:publicItem(d)});
      const conversation=await base44.agents.getConversation(cid).catch(()=>null);
      if(!conversation)return Response.json({ok:true,handoff:publicItem(d)});
      const messages=Array.isArray(conversation.messages)?conversation.messages:[];
      const lastUser=messages.map((m:any)=>m.role).lastIndexOf('user');
      const lastAnswer=messages.map((m:any)=>m.role).lastIndexOf('assistant');
      if(lastAnswer<=lastUser)return Response.json({ok:true,handoff:publicItem(d)});
      const reply=messages[lastAnswer],calls=reply.tool_calls||[];
      const busy=calls.some((c:any)=>['pending','running'].includes(c.status));
      if(busy)return Response.json({ok:true,handoff:publicItem(d)});
      const toolError=calls.some((c:any)=>['error','stopped','waiting_for_user_input'].includes(c.status));
      const informative=d.continuation_state?.pending_step==='informational_answer';
      // Natural language alone never verifies a consequential write.
      const status=toolError?'needs_review':informative?'completed':'needs_review';
      const summary=toolError?'Specialist encountered an unfinished tool step.':
        informative?'Specialist responded; review its verified findings.':
          'Specialist responded; a consequential action still needs authoritative result verification.';
      const updated=await sr.entities.AgentDelegation.update(id,{
        status,result_summary:summary,updated_at:new Date().toISOString(),
        ...(informative&&!toolError?{verification:'Agent conversation response received'}:{}),
        ...(informative&&!toolError?{completed_at:new Date().toISOString()}:{})
      });
      return Response.json({ok:true,handoff:publicItem(updated)});
    }
    if(mode!=='dispatch')return Response.json({error:'Unsupported handoff mode'},{status:400});
    const source=trim(body.source_agent||'chief_of_staff',80);
    const capability=trim(body.capability,50).toLowerCase();
    const target=trim(body.target_agent||SPECIALISTS[capability],80);
    const objective=trim(body.objective,900);
    const context=trim(body.context_summary,1500);
    const campaignId=trim(body.campaign_id,90);
    if(!TARGETS.has(source)||!TARGETS.has(target)||target===source||!objective||objective.length<8){
      return Response.json({error:'Choose a valid different specialist and a concrete objective.'},{status:400});
    }
    // A source agent cannot route a request to a target it invented. Unknown
    // capabilities must be reviewed, not granted via arbitrary target names.
    if(!SPECIALISTS[capability]||SPECIALISTS[capability]!==target){
      return Response.json({error:'That specialist is not registered for the requested capability.'},{status:400});
    }
    if(target==='managed_connection_agent'&&!hasManagedConnections(user))
      return Response.json({error:'Managed Connections is not included in this plan.'},{status:403});
    if(campaignId){
      const campaign=await sr.entities.Campaign.get(campaignId).catch(()=>null);
      if(!campaign||campaign.created_by_id!==user.id)
        return Response.json({error:'Campaign is not accessible to this member.'},{status:403});
    }
    const recent=await sr.entities.AgentDelegation.filter({
      owner_user_id:user.id,destination_agent:target},'-created_date',40).catch(()=>[]);
    const duplicate=(recent||[]).find((d:any)=>live.has(d.status)&&
      d.source_agent===source&&d.objective===objective&&d.campaign_id===campaignId);
    if(duplicate)return Response.json({ok:true,reused:true,handoff:publicItem(duplicate)});
    const now=new Date().toISOString();
    const informational=['research','analytics','planning','finance','donations','discovery','strategy','growth'].includes(capability);
    const record=await sr.entities.AgentDelegation.create({
      owner_user_id:user.id,source_agent:source,destination_agent:target,
      campaign_id:campaignId,objective,context_summary:context,status:'assigned',
      consent_version:trim(user.ai_obo_consent?.permission_version,120),
      continuation_state:{pending_step:informational?'informational_answer':'verify_executed_action'},
      retry_count:0,created_at:now,updated_at:now
    });
    try{
      const conversation=await base44.agents.createConversation({
        agent_name:target,metadata:{name:'IFund specialist handoff',delegation_id:record.id,
          source_agent:source,owner_user_id:user.id,campaign_id:campaignId}
      });
      // Forward minimal task context, not credentials, login sessions or agent
      // tool output. Target performs any action through its own permitted tools.
      const prompt=[
        'Specialist handoff from IFund '+source+'.',
        'The signed-in account owner requested: '+objective,
        campaignId?'Campaign ID: '+campaignId:'',
        context?'Relevant context (unverified unless confirmed): '+context:'',
        'Use your configured tools and fresh owner-scoped records to proceed.',
        'Do not claim publication, authorization, or completion without an authoritative tool/provider result.',
        'If the action needs a user/provider approval, pause and report what remains.',
        'Task tracking ID: '+record.id
      ].filter(Boolean).join('\n');
      await base44.agents.addMessage(conversation,{role:'user',content:prompt});
      const updated=await sr.entities.AgentDelegation.update(record.id,{
        status:'in_progress',updated_at:new Date().toISOString(),
        continuation_state:{
          pending_step:informational?'informational_answer':'verify_executed_action',
          continuation_ref:conversation.id
        }
      });
      await logAudit(base44,{action:'agent_specialist_handoff',
        actor_user_id:user.id,target_type:'AgentDelegation',target_id:record.id,
        detail:'Task dispatched to '+target,status:'success'}).catch(() => {});
      return Response.json({ok:true,dispatched:true,handoff:publicItem(updated)});
    }catch(error){
      await sr.entities.AgentDelegation.update(record.id,{
        status:'failed',result_summary:'Specialist conversation could not be started.',
        updated_at:new Date().toISOString()
      });
      return Response.json({error:'Specialist handoff could not start. The task was not completed.',
        handoff_id:record.id},{status:502});
    }
  }catch(e){
    console.error('routeAgentTask:',e instanceof Error?e.name:'Error');
    return Response.json({error:'Could not route this task to a specialist.'},{status:500});
  }
}