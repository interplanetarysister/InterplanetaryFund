import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { logAudit } from '../../shared/auditLog.ts';
const SUPER_ADMIN_OWNER_EMAILS=new Set(['cuddlemeplatonically@gmail.com','interplanetarysister@gmail.com']);
const isSuperAdminOwner=(user)=>user?.role==='admin'&&SUPER_ADMIN_OWNER_EMAILS.has(String(user?.email||'').trim().toLowerCase());
export default async function(req){
  try{
    const base44=createClientFromRequest(req); const activeAccount = await assertActiveAccount(base44); if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status }); const actor=await base44.auth.me().catch(()=>null);
    if(!actor)return Response.json({error:'Unauthorized'},{status:401});
    if(!isSuperAdminOwner(actor))return Response.json({error:'Forbidden — super admin only.'},{status:403});
    const body=await req.json().catch(()=>({})),userId=String(body.user_id||''),role=String(body.role||'');
    if(!userId||!['user','admin'].includes(role))return Response.json({error:'Invalid role update request'},{status:400});
    if(userId===actor.id)return Response.json({error:'You cannot change your own role.'},{status:400});
    const sr=base44.asServiceRole,target=await sr.entities.User.get(userId).catch(()=>null);
    if(!target)return Response.json({error:'User not found'},{status:404});
    const targetEmail=String(target.email||'').trim().toLowerCase();
    if(SUPER_ADMIN_OWNER_EMAILS.has(targetEmail)&&role!=='admin')return Response.json({error:'Protected super-admin ownership cannot be removed here.'},{status:409});
    const previousRole=target.role||'user';
    await sr.entities.User.update(target.id,{role});
    await logAudit(base44,{action:'admin_user_role_changed',actor_user_id:actor.id,target_type:'User',target_id:target.id,detail:`role ${previousRole} -> ${role}`,status:'success'});
    return Response.json({ok:true,user_id:target.id,role});
  }catch(error){console.error('adminUpdateUserRole failed:',error?.message||error);return Response.json({error:'User role could not be updated safely.'},{status:500});}
}
