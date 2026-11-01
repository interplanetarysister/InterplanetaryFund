import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { logAudit } from '../../shared/auditLog.ts';

export default async function(req){
  try{
    const base44=createClientFromRequest(req); const activeAccount = await assertActiveAccount(base44); if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user=await base44.auth.me().catch(()=>null);
    if(!user) return Response.json({error:'Unauthorized'},{status:401});
    const body=await req.json().catch(()=>({}));
    const action=String(body.action||'').toLowerCase();
    if(action!=='disconnect') return Response.json({error:'Unsupported payout-account action.'},{status:400});

    const sr=base44.asServiceRole;
    const rows=await sr.entities.ConnectedPayoutAccount.filter({owner_user_id:user.id,provider:'stripe_connect'},'-updated_date',10).catch(()=>[]);
    if(!rows?.length) return Response.json({ok:true,configured:false,status:'disabled',duplicate:true});

    const canonical=[...rows].sort((a,b)=>{
      const at=new Date(a.created_date||0).getTime();
      const bt=new Date(b.created_date||0).getTime();
      if(at!==bt) return at-bt;
      return String(a.id||'').localeCompare(String(b.id||''));
    })[0];

    await sr.entities.ConnectedPayoutAccount.update(canonical.id,{
      status:'disabled',
      payouts_enabled:false,
      charges_enabled:false,
      last_error:'Disconnected by owner.',
    });
    for(const duplicate of rows){
      if(duplicate.id!==canonical.id) await sr.entities.ConnectedPayoutAccount.delete(duplicate.id).catch(()=>{});
    }

    await logAudit(base44,{
      action:'connected_payout_account_disconnected',
      actor_user_id:user.id,
      target_type:'ConnectedPayoutAccount',
      target_id:canonical.id,
      detail:'Owner disconnected the IFund Stripe Connect settlement account from active IFund use. External provider account deletion was not implied.',
      status:'success',
      metadata:{provider:'stripe_connect'},
    });
    return Response.json({ok:true,configured:false,status:'disabled'});
  }catch(error){
    console.error('manageConnectedPayoutAccount failed:',error?.name||'UnknownError');
    return Response.json({error:'Connected payout account could not be updated.'},{status:500});
  }
}
