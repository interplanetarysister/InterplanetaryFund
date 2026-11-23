// A restricted substep of audited account erasure, never a full account delete.
// Deletes only private campaign-document bytes and their matching metadata.
// The endpoint must remain disabled until isolated testing and independent
// approval of the account-deletion queue workflow.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH=/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(pdf|docx|xlsx|txt|md|csv)$/i;
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
 if(typeof row?.storage_path!=="string"||
    typeof row.storage_present!=="boolean"||typeof row.metadata_present!=="boolean"||
    (!row.storage_present&&!row.metadata_present)||
    (row.metadata_present&&!UUID.test(row.document_id||""))||
    (!row.metadata_present&&row.document_id!==null))
   throw Error("Unverifiable document inventory.");
 const m=PATH.exec(row.storage_path);
 if(!m||m[1]!==owner||(row.document_id&&m[3]!==row.document_id))
   throw Error("Document path does not belong to deletion requester.");
 return row.storage_path;
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
 if(!item||item.request_status!=="reviewing"||!UUID.test(item.requested_user_id||""))
   throw Error("An independently reviewed account deletion request is required.");
 return item.requested_user_id;
}
async function listOwnerDocuments({fetcher,url,key,owner,requestId,jwt}){
 const rows=await fetchJson(fetcher,url+"/rest/v1/rpc/ifund_super_admin_private_document_inventory",{
   method:"POST",headers:{"apikey":key,Authorization:"Bearer "+jwt,"content-type":"application/json"},
   body:JSON.stringify({p_request_id:requestId,p_limit:100})
 });
 if(!Array.isArray(rows)||rows.length>100)throw Error("Private-document inventory is invalid.");
 rows.forEach(row=>validateRow(row,owner));
 return rows;
}
async function markPending({fetcher,url,key,owner,row}){
 if(!row.metadata_present||row.deletion_requested_at)return;
 const endpoint=url+"/rest/v1/ifund_campaign_documents?id=eq."+row.document_id+
   "&owner_id=eq."+owner+"&deletion_requested_at=is.null";
 const result=await fetchJson(fetcher,endpoint,{method:"PATCH",
   headers:serviceHeaders(key,true),
   body:JSON.stringify({allow_agent_use:false,deletion_requested_at:new Date().toISOString()})
 });
 if(!Array.isArray(result)||result.length!==1||result[0].id!==row.document_id||
    result[0].allow_agent_use!==false||!result[0].deletion_requested_at)
   throw Error("Private document consent revocation could not be confirmed.");
}
async function deleteOne({fetcher,url,key,owner,row}){
 const path=validateRow(row,owner);
 await markPending({fetcher,url,key,owner,row});
 if(row.storage_present){
   const remove=await fetchJson(fetcher,url+"/storage/v1/object/ifund-campaign-documents",{
     method:"DELETE",headers:serviceHeaders(key),body:JSON.stringify({prefixes:[path]})
   });
   if(!Array.isArray(remove))throw Error("Private Storage cleanup receipt is invalid.");
 }
 // Confirm missing bytes BEFORE removing the only durable cleanup reference.
 const encoded=path.split("/").map(encodeURIComponent).join("/");
 const info=await fetcher(url+"/storage/v1/object/info/ifund-campaign-documents/"+encoded,{
   method:"GET",headers:serviceHeaders(key),signal:AbortSignal.timeout(20000)
 });
 if(info.status!==404)throw Error("Private Storage deletion could not be independently verified.");
 let missing;
 try{missing=await info.json();}catch{throw Error("Private Storage absence receipt is invalid.");}
 // A 404 can also mean a missing bucket or an inaccessible object. Only
 // an explicit NoSuchKey confirms that this particular file is absent.
 if(missing?.code!=="NoSuchKey")
   throw Error("Private Storage absence receipt is not a missing-file proof.");
 if(row.metadata_present){
   const endpoint=url+"/rest/v1/ifund_campaign_documents?id=eq."+row.document_id+"&owner_id=eq."+owner+
     "&deletion_requested_at=not.is.null";
   const deleted=await fetchJson(fetcher,endpoint,{
     method:"DELETE",headers:serviceHeaders(key,true)
   });
   if(!Array.isArray(deleted)||deleted.length!==1||deleted[0].id!==row.document_id)
     throw Error("Private document metadata cleanup was not confirmed.");
 }
}
export async function cleanupPrivateCampaignDocuments({fetcher=fetch,env,requestId,jwt}){
  // Production stores private campaign documents in Cloudflare R2, not Supabase Storage.
  // This legacy deletion implementation must never run against the live R2 contract:
  // it cannot prove an owner-bound immutable object receipt or serialized deletion.
  // Fail closed even if the historical feature flag is accidentally enabled.
  throw Error("R2 private-document deletion requires verified identity-locked adapter.");
 const {url,key}=config(env);
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
     await deleteOne({fetcher,url,key,owner,row});
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
