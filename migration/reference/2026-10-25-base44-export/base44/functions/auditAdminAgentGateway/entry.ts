import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
const SUPER_ADMIN_OWNER_EMAILS=new Set(['cuddlemeplatonically@gmail.com','interplanetarysister@gmail.com']);
const isSuperAdminOwner=(user)=>user?.role==='admin'&&SUPER_ADMIN_OWNER_EMAILS.has(String(user?.email||'').trim().toLowerCase());
import { logAudit } from '../../shared/auditLog.ts';
export default async function(req) {
  try {
    const base44=createClientFromRequest(req); const activeAccount = await assertActiveAccount(base44); if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user=await base44.auth.me().catch(()=>null);
    if(!user) return Response.json({error:'Unauthorized'},{status:401});
    if(!isSuperAdminOwner(user)) return Response.json({error:'Forbidden — super admin only.'},{status:403});
    const body=await req.json().catch(()=>({}));
    await logAudit(base44,{action:String(body.type||'admin_agent_gateway').slice(0,120),actor_user_id:user.id,target_type:'DevelopmentAgent',target_id:String(body.agent||'chief_of_staff').slice(0,120),detail:String(body.status||'recorded').slice(0,500),status:body.status==='failed'?'failure':'success',metadata:{request_id:String(body.requestId||'').slice(0,200),source:'portable_admin_gateway'}});
    return Response.json({ok:true});
  } catch(error) {
    console.error('auditAdminAgentGateway error',error?.message||error);
    return Response.json({error:'Unable to record gateway audit.'},{status:500});
  }
}
