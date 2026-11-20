import {removeVerifiedR2Document,canonicalDocumentKey} from './privateDocumentR2.mjs';
// A restricted substep of audited account erasure, never a full account delete.
// Deletes only private campaign-document bytes and their matching metadata.
// The endpoint must remain disabled until isolated testing and independent
// approval of the account-deletion queue workflow.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json=(code,value)=>Response.json(value,{status:code,headers:{"cache-control":"no-store"}});
const isValidBody=(data)=>data&&typeof data==="object"&&!Array.isArray(data)&&
  Object.keys(data).length===1&&UUID.test(data.request_id||"");
const staffToken=(request)=>/^Bearer [\w.~-]+$/.test(request.headers.get("authorization")||"")
  ? request.headers.get("authorization").slice(7):null;
function config(env){
 const url=String(env.SUPABASE_URL||"").replace(/\/$/,"");
 const key=env.SUPABASE_SECRET_KEY;
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)||typeof key!=="string"||key.length<20)
   throw Error("Private document cleanup is not configured.");
 return {url,key};
}
const serviceHeaders=(key,returnRows=false)=>({
  // Opaque sb_secret keys authenticate through apikey, not a Bearer JWT.
  "apikey":key,"content-type":"application/json",
  ...(returnRows?{Prefer:"return=representation"}:{})
});
async function fetchJson(fetcher,url,init){
 const res=await fetcher(url,{...init,signal:AbortSignal.timeout(20000)});
 if(!res.ok)throw Error("Private document service refused the operation.");
 const value=await res.json();
 return value;
}
function validateRow(row,owner){
 if(!UUID.test(row?.document_id||'')||!UUID.test(row?.campaign_id||'')||
    typeof row?.deletion_requested_at!=='string'||!row.deletion_requested_at)
   throw Error('Document must be staged for deletion before object cleanup.');
 return canonicalDocumentKey(row,owner);
}
async function authorizeRequest({fetcher,url,key,jwt,requestId}){
 const rows=await fetchJson(fetcher,url+"/rest/v1/rpc/ifund_super_admin_account_deletion_queue",{
   method:"POST",headers:{"apikey":key,Authorization:"Bearer "+jwt,"content-type":"application/json"},
   body:JSON.stringify({p_limit:200})
 });
 if(!Array.isArray(rows))throw Error("Administrative deletion queue response is invalid.");
 // The server-side RPC verifies the super administrator; a request ID alone
 // cannot authorize erasure. Only the reviewed state allows this substep.
 const item=rows.find(row=>row.request_id===requestId);
 if(!item||item.request_status!=='reviewing'||!UUID.test(item.requested_user_id||''))
   throw Error('An authorized deletion request is required.');
 const reviewed=await fetchJson(fetcher,url+'/rest/v1/rpc/ifund_super_admin_private_document_reviewed_queue',{
   method:'POST',headers:{apikey:key,Authorization:'Bearer '+jwt,'content-type':'application/json'},body:'{}'
 });
 if(!Array.isArray(reviewed)||!reviewed.some(row=>row.request_id===requestId&&row.review_ready===true))
   throw Error('Independent review approval is missing.');
 return item.requested_user_id;
}
async function listOwnerDocuments({fetcher,url,key,owner,requestId,jwt}){
 const rows=await fetchJson(fetcher,url+"/rest/v1/rpc/ifund_super_admin_private_document_inventory",{
   method:"POST",headers:{"apikey":key,Authorization:"Bearer "+jwt,"content-type":"application/json"},
   body:JSON.stringify({p_owner_id:owner,p_limit:100})
 });
 if(!Array.isArray(rows)||rows.length>100)throw Error("Private-document inventory is invalid.");
 rows.forEach(row=>validateRow(row,owner));
 return rows;
}
async function deleteOne({fetcher,url,key,owner,row,bucket}){
 const path=validateRow(row,owner);
 // R2 object deletion requires a separate, verified serialization mechanism.
 // No unsafe HEAD-then-unconditional-delete is permitted by this endpoint.
 if(!bucket?.head||!bucket?.delete)throw Error('R2 binding unavailable.');
 if(!bucket?.ifundIdentityLockedDeletion)throw Error('Identity-locked R2 deletion not verified.');
 await removeVerifiedR2Document({bucket,row,owner});
 const endpoint=url+'/rest/v1/ifund_campaign_documents?id=eq.'+row.document_id+
   '&owner_id=eq.'+owner+'&storage_path=eq.'+encodeURIComponent(path)+
   '&object_etag=eq.'+encodeURIComponent(row.object_etag)+
   '&object_sha256=eq.'+row.object_sha256+'&deletion_requested_at=not.is.null';
 const deleted=await fetchJson(fetcher,endpoint,{method:'DELETE',headers:serviceHeaders(key,true)});
 if(!Array.isArray(deleted)||deleted.length!==1||deleted[0].id!==row.document_id)
   throw Error('Immutable metadata deletion receipt missing.');
}
export async function cleanupPrivateCampaignDocuments({fetcher=fetch,env,requestId,jwt}){
 const {url,key}=config(env);
 const bucket=env.IFUND_CAMPAIGN_MEDIA;
 if(!UUID.test(requestId||"")||!jwt||!/^[\w.~-]+$/.test(jwt))
   throw Error("Verified deletion request and administrator session required.");
 const owner=await authorizeRequest({fetcher,url,key,jwt,requestId});
 let removed=0;
 // Bound the work per invocation for free-tier Worker request duration.
 // Each successful deletion shrinks the next inventory query, so retries
 // cannot skip or duplicate records. Another explicit call resumes cleanup.
 const batchLimit=10;
 while(removed<batchLimit){
   const rows=await listOwnerDocuments({fetcher,url,key,owner,requestId,jwt});
   if(!rows.length)return {verified:true,more_documents:false,documents_removed:removed,account_deleted:false};
   for(const row of rows.slice(0,batchLimit-removed)){
     await deleteOne({fetcher,url,key,owner,row,bucket});
     removed++;
   }
 }
 const remaining=await listOwnerDocuments({fetcher,url,key,owner,requestId,jwt});
 return {verified:remaining.length===0,more_documents:remaining.length>0,
   documents_removed:removed,account_deleted:false};
}
export async function handlePrivateDocumentErasure(request,env,{fetcher=fetch}={}){
 if(request.method!=="POST")return json(405,{error:"Method not allowed."});
 if(env.IFUND_DOCUMENT_ERASURE_ENABLED!=="enabled")
   return json(503,{error:"Privileged document cleanup is not enabled."});
 const jwt=staffToken(request);
 if(!jwt)return json(401,{error:"A verified administrative session is required."});
 let input;
 try{
   const raw=await request.text();
   if(raw.length>1024) return json(413,{error:"Request too large."});
   input=JSON.parse(raw);
 }catch{return json(400,{error:"Invalid request body."});}
 if(!isValidBody(input))return json(400,{error:"A valid deletion request reference is required."});
 try{
   const result=await cleanupPrivateCampaignDocuments({
     fetcher,env,requestId:input.request_id,jwt
   });
   return json(200,result);
 }catch{
   // Never disclose user IDs, document content, server keys, or provider errors.
   return json(503,{error:"Private-document cleanup is not complete. Verify the authorized queue and retry."});
 }
}
