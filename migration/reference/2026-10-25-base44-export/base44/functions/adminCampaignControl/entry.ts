import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { logAudit } from '../../shared/auditLog.ts';
export default async function(req){
  try{
    const base44=createClientFromRequest(req); const activeAccount = await assertActiveAccount(base44); if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status }); const user=await base44.auth.me().catch(()=>null);
    if(!user)return Response.json({error:'Unauthorized'},{status:401});
    if(user.role!=='admin')return Response.json({error:'Forbidden'},{status:403});
    const body=await req.json().catch(()=>({})),campaignId=String(body.campaign_id||''),action=String(body.action||''),reason=String(body.reason||'').trim().slice(0,500);
    if(!campaignId||!['pause','restore'].includes(action))return Response.json({error:'Invalid campaign control request'},{status:400});
    if(action==='pause'&&!reason)return Response.json({error:'A pause reason is required'},{status:400});
    const sr=base44.asServiceRole,campaign=await sr.entities.Campaign.get(campaignId).catch(()=>null);
    if(!campaign)return Response.json({error:'Campaign not found'},{status:404});
    const status=action==='pause'?'paused':'active';
    await sr.entities.Campaign.update(campaign.id,{status});
    await logAudit(base44,{action:action==='pause'?'campaign_paused_by_admin':'campaign_restored_by_admin',actor_user_id:user.id,target_type:'Campaign',target_id:campaign.id,detail:reason||'Campaign restored by administrator',status:'success'});
    return Response.json({ok:true,campaign_id:campaign.id,status});
  }catch(error){console.error('adminCampaignControl failed:',error?.message||error);return Response.json({error:'Campaign control action could not be completed safely.'},{status:500});}
}
