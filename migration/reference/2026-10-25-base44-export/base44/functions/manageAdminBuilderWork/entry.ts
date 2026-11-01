import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { logAudit } from '../../shared/auditLog.ts';

// Server-enforced super-admin-only build-work intake.
// Queues auditable build tasks; DOES NOT claim to edit source or deploy code.
const SUPER_ADMIN_OWNER_EMAILS=new Set(['cuddlemeplatonically@gmail.com','interplanetarysister@gmail.com']);
const isSuperAdmin=(user:any)=>user?.role==='admin'&&SUPER_ADMIN_OWNER_EMAILS.has(String(user?.email||'').trim().toLowerCase());
const safe=(v:any,n:number)=>String(v??'').trim().slice(0,n);
export default async function(req:Request) {
  try {
    const base44=createClientFromRequest(req);
    const guard=await assertActiveAccount(base44);
    if(!guard.ok)return Response.json({error:guard.error},{status:guard.status});
    const owner=guard.user;
    if(!isSuperAdmin(owner))return Response.json({error:'Forbidden — super admin only.'},{status:403});
    const body=await req.json().catch(()=>({}));
    const mode=safe(body.mode||'list',20);
    const sr=base44.asServiceRole;
    if(mode==='list'){
      const records=await sr.entities.AgentDelegation.filter({owner_user_id:owner.id,destination_agent:'admin_builder_agent'},'-created_date',100);
      return Response.json({ok:true,work:(records||[]).filter((d:any)=>d.owner_user_id===owner.id && d.destination_agent==='admin_builder_agent').map((d:any)=>({
        id:d.id,objective:d.objective,status:d.status,context_summary:d.context_summary,verification:d.verification,result_summary:d.result_summary,created_at:d.created_at
      }))});
    }
    if(mode!=='queue')return Response.json({error:'Unsupported builder operation'},{status:400});
    const objective=safe(body.objective,500);
    if(objective.length<12)return Response.json({error:'Describe the requested build change'},{status:400});
    const context=safe(body.context_summary,1800);
    const now=new Date().toISOString();
    const task=await sr.entities.AgentDelegation.create({
      owner_user_id:owner.id,source_agent:'admin_builder_agent',destination_agent:'admin_builder_agent',
      objective,context_summary:context,status:'requested',result_summary:'Awaiting authorized implementation and verification',
      verification:'No code change, build, test, or deployment performed by queueing this task.',
      created_at:now,updated_at:now,
    });
    await logAudit(base44,{action:'super_admin_build_task_queued',actor_user_id:owner.id,target_type:'AgentDelegation',target_id:task.id,detail:objective,status:'success'});
    return Response.json({ok:true,task_id:task.id,status:'requested',implemented:false});
  }catch(error){
    console.error('manageAdminBuilderWork:',error instanceof Error?error.name:'Error');
    return Response.json({error:'Admin build request could not be processed.'},{status:500});
  }
}
