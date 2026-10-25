import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
const SUPER_ADMIN_OWNER_EMAILS=new Set(['cuddlemeplatonically@gmail.com','interplanetarysister@gmail.com']);
const isSuperAdminOwner=(user)=>user?.role==='admin'&&SUPER_ADMIN_OWNER_EMAILS.has(String(user?.email||'').trim().toLowerCase());
export default async function(req) {
  try {
    const base44=createClientFromRequest(req); const activeAccount = await assertActiveAccount(base44); if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user=await base44.auth.me().catch(()=>null);
    if(!user) return Response.json({error:'Unauthorized'},{status:401});
    if(!isSuperAdminOwner(user)) return Response.json({error:'Forbidden — super admin only.'},{status:403});
    return Response.json({id:user.id,role:'admin',super_admin:true});
  } catch(error) {
    console.error('verifyAdminGateway error',error?.message||error);
    return Response.json({error:'Unable to verify administrator.'},{status:500});
  }
}
