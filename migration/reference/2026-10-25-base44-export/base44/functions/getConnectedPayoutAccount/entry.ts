import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';

export default async function(req){
  try{
    const base44=createClientFromRequest(req); const activeAccount = await assertActiveAccount(base44); if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user=await base44.auth.me().catch(()=>null);
    if(!user) return Response.json({error:'Unauthorized'},{status:401});
    const sr=base44.asServiceRole;
    const rows=await sr.entities.ConnectedPayoutAccount.filter({owner_user_id:user.id,provider:'stripe_connect'},'-updated_date',10).catch(()=>[]);
    // Converge any duplicate records for the same owner+provider to one canonical
    // entry. This cleans up duplicates that may have been created by a concurrent
    // onboarding race before the fix, and keeps the invariant: one owner + one
    // payout provider → one local ConnectedPayoutAccount.
    let record=rows[0]||null;
    if(rows.length>1){
      const ordered=[...rows].sort((a,b)=>{
        const at=new Date(a.created_date||0).getTime();
        const bt=new Date(b.created_date||0).getTime();
        if(at!==bt) return at-bt;
        return String(a.id||'').localeCompare(String(b.id||''));
      });
      record=ordered[0];
      const patch:any={};
      for(const dup of ordered.slice(1)){
        if(dup.status==='ready'&&record.status!=='ready') patch.status='ready';
        if(dup.payouts_enabled&&!record.payouts_enabled) patch.payouts_enabled=true;
        if(dup.charges_enabled&&!record.charges_enabled) patch.charges_enabled=true;
        if(dup.details_submitted&&!record.details_submitted) patch.details_submitted=true;
        if(dup.last_verified_at&&!record.last_verified_at) patch.last_verified_at=dup.last_verified_at;
        if(dup.provider_account_id&&!record.provider_account_id) patch.provider_account_id=dup.provider_account_id;
      }
      // Persist canonical merged state BEFORE deleting duplicates. A failed
      // persist must abort convergence — never destroy duplicate state before
      // the canonical record has absorbed the information it must preserve.
      if(Object.keys(patch).length){
        await sr.entities.ConnectedPayoutAccount.update(record.id,patch);
      }
      for(const dup of ordered.slice(1)){
        await sr.entities.ConnectedPayoutAccount.delete(dup.id).catch(()=>{});
      }
    }
    if(!record) return Response.json({ok:true,configured:false,status:'not_started',provider_available:false});
    const key=secrets.get('STRIPE_SECRET_KEY');
    if(record.status==='disabled') return Response.json({ok:true,configured:false,status:'disabled',payouts_enabled:false,provider_available:!!(key&&String(key).startsWith('sk_live_')),provider:'stripe_connect'});
    if(!key||!String(key).startsWith('sk_live_')) return Response.json({ok:true,configured:true,status:'unavailable',payouts_enabled:false,provider_available:false,provider:'stripe_connect'});
    const stripe=new Stripe(key);
    const account=await stripe.accounts.retrieve(record.provider_account_id);
    const status=account.payouts_enabled&&account.details_submitted?'ready':account.details_submitted?'restricted':'onboarding';
    const patch={status,charges_enabled:!!account.charges_enabled,payouts_enabled:!!account.payouts_enabled,details_submitted:!!account.details_submitted,default_currency:String(account.default_currency||'').toUpperCase(),country:String(account.country||''),last_verified_at:new Date().toISOString(),last_error:''};
    await sr.entities.ConnectedPayoutAccount.update(record.id,patch);
    return Response.json({ok:true,configured:true,status,...patch,provider:'stripe_connect',provider_available:true});
  }catch(error){
    console.error('getConnectedPayoutAccount failed:',error?.name||'UnknownError');
    return Response.json({error:'Connected payout account status could not be verified.'},{status:500});
  }
}