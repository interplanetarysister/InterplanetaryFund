import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { logAudit } from '../../shared/auditLog.ts';
import { assertExternalSyncClaimActive, beginExternalSyncRequest, crowdfundingConnectionEligibility, failExternalSyncRequest, finishExternalSyncRequest, validExternalSyncRequestId } from '../../shared/externalSyncRequest.ts';
import { discoverPublicCampaignSnapshot } from './publicCampaignSnapshot.ts';

const FIELDS=['title','summary','story','category','goal_amount','cover_image_url','end_date','location'];
const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);

export default async function(req){
  let base44; let sr; let run; let claimKey; let user; let requestId='';
  try{
    base44=createClientFromRequest(req);
    const activeAccount=await assertActiveAccount(base44);
    if(!activeAccount.ok) return Response.json({error:activeAccount.error},{status:activeAccount.status});
    user=await base44.auth.me().catch(()=>null);
    if(!user) return Response.json({error:'Unauthorized'},{status:401});
    const body=await req.json().catch(()=>({}));
    requestId=String(body.request_id||'').trim();
    if(!validExternalSyncRequestId(requestId)) return Response.json({error:'A valid request_id is required for an explicit refresh.'},{status:400});
    sr=base44.asServiceRole;
    const record=await sr.entities.ExternalCampaignImport.get(body.import_id);
    const isAdmin=['admin','super_admin'].includes(user.role);
    if(!record||(!isAdmin&&record.owner_user_id!==user.id)) return Response.json({error:'Imported campaign link not found.'},{status:404});
    const [campaign,connection]=await Promise.all([
      sr.entities.Campaign.get(record.campaign_id),
      sr.entities.PlatformConnection.get(record.connection_id),
    ]);
    if(!campaign||campaign.created_by_id!==record.owner_user_id||!crowdfundingConnectionEligibility(connection,record.owner_user_id).ok) return Response.json({error:'Campaign connection is not available.'},{status:409});
    const fingerprint=JSON.stringify({import_id:record.id,owner_user_id:record.owner_user_id});
    const request=await beginExternalSyncRequest(sr,{jobType:'imported_campaign_refresh',actorUserId:user.id,requestId,fingerprint,initiatorType:isAdmin?'admin':'user',scope:'campaign',campaignId:campaign.id});
    if(request.disposition==='completed') return Response.json({...request.run.result_payload,deduplicated:true});
    if(request.disposition==='in_progress') return Response.json({ok:false,request_id:requestId,status:'in_progress',deduplicated:true},{status:202});
    run=request.run; claimKey=request.claimKey;
    await assertExternalSyncClaimActive(sr,run,claimKey);
    const discovered=await discoverPublicCampaignSnapshot(connection);
    await assertExternalSyncClaimActive(sr,run,claimKey);
    const snapshot=discovered.campaign;
    const provenance={...(record.field_provenance||{})};
    const locked=new Set(record.locally_locked_fields||[]);
    const patch={};
    const now=new Date().toISOString();
    for(const key of FIELDS){
      if(snapshot[key]===undefined) continue;
      const previous=provenance[key]?.source_value;
      if(previous!==undefined&&!same(campaign[key],previous)) locked.add(key);
      if(locked.has(key)) continue;
      patch[key]=snapshot[key];
      provenance[key]={source:key==='category'?'system_default':discovered.source,connection_id:connection.id,imported_at:now,source_value:snapshot[key]};
    }
    if(Object.keys(patch).length){
      await assertExternalSyncClaimActive(sr,run,claimKey);
      await sr.entities.Campaign.update(campaign.id,patch);
    }
    await assertExternalSyncClaimActive(sr,run,claimKey);
    await sr.entities.ExternalCampaignImport.update(record.id,{last_imported_at:now,source_updated_at:now,external_url:discovered.source_url,field_provenance:provenance,locally_locked_fields:[...locked],status:'imported'});
    const result={ok:true,request_id:requestId,campaign_id:campaign.id,updated_fields:Object.keys(patch),locally_locked_fields:[...locked]};
    await finishExternalSyncRequest(sr,run,claimKey,{overall_status:'success',campaign_id:campaign.id,result_payload:result,description:'Explicit imported campaign refresh completed.'});
    await logAudit(base44,{action:'external_campaign_synced',actor_user_id:user.id,target_type:'Campaign',target_id:campaign.id,detail:'Explicitly refreshed unlocked fields from a connected external campaign without overwriting local edits.',status:'success',metadata:{request_id:requestId,request_origin:'explicit_authenticated_action',owner_user_id:record.owner_user_id,admin_scoped:isAdmin,platform:connection.platform,connection_id:connection.id,updated_fields:Object.keys(patch),locked_fields:[...locked]}});
    return Response.json(result);
  }catch(error){
    console.error('syncImportedCampaign failed:',error?.name||'UnknownError');
    const claimLost=error?.code==='claim_lost';
    let failureFinalized=!run;
    if(!claimLost&&sr&&run&&claimKey) failureFinalized=Boolean(await failExternalSyncRequest(sr,run,claimKey,'Explicit imported campaign refresh failed.').catch(()=>null));
    if(!claimLost&&failureFinalized&&base44&&user?.id) await logAudit(base44,{action:'external_campaign_sync_failed',actor_user_id:user.id,target_type:'SyncRun',target_id:run?.id||requestId,detail:'Explicit imported campaign refresh failed safely.',status:'failure',metadata:{request_id:requestId||null,reason:error?.code||'provider_error'}}).catch(()=>{});
    return Response.json({error:error?.message||'Imported campaign synchronization could not complete.'},{status:error?.status||500});
  }
}
