// Owner-only read transport for the existing private R2 document store.
// Never exposes an R2 URL, accepts a storage path, or changes stored data.
import { memberApi, SUPABASE_ORIGIN, UUID, reply } from "../agents/memberApi.js";
import { readJsonBody } from "../bodyLimit.js";
import { documentObjectKey } from "./r2DocumentIdentity.mjs";
import { verifiedPrivateDocumentRead } from "./r2DocumentRead.mjs";

const TYPES=Object.freeze({
 "application/pdf":"pdf",
 "application/vnd.openxmlformats-officedocument.wordprocessingml.document":"docx",
 "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"xlsx",
 "text/plain":"txt","text/markdown":"md","text/csv":"csv"
});
const FIELDS="id,owner_id,campaign_id,storage_path,object_store,object_etag,object_sha256,object_verified_at,file_size,media_type,deletion_requested_at";
async function readRows(path,api,env,fetcher){
 const result=await fetcher(SUPABASE_ORIGIN+path,{
  headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,authorization:"Bearer "+api.jwt,accept:"application/json"},
  redirect:"error",signal:AbortSignal.timeout(12000)
 });
 if(!result.ok)throw Error("Private document metadata unavailable");
 const rows=await readJsonBody(result,64000);
 if(!Array.isArray(rows))throw Error("Invalid private document metadata");
 return rows;
}
async function eligible(api){
 return (await api.rpc("ifund_member_connection_allowed"))===true &&
        (await api.rpc("ifund_current_user_has_current_terms"))===true;
}
export async function routePrivateDocumentDownload(request,env,{fetcher=fetch,authenticate=memberApi}={}){
 if(request.method!=="GET")return reply(405,{error:"Method not allowed."});
 if(env.IFUND_PRIVATE_R2_DOCUMENT_READ_ENABLED!=="enabled")return reply(503,{error:"Private document downloads are not enabled."});
 const params=new URL(request.url).searchParams;
 const campaignId=params.get("campaign_id"),documentId=params.get("document_id");
 if([...params.keys()].length!==2||params.getAll("campaign_id").length!==1||params.getAll("document_id").length!==1||
    !UUID.test(campaignId||"")||!UUID.test(documentId||""))
  return reply(400,{error:"Choose an owned campaign document."});
 try{
  const api=await authenticate(request,env,fetcher);
  const ownerId=api.user.id;
  if(!UUID.test(ownerId||"")||!await eligible(api))return reply(403,{error:"An active verified member account and current terms are required."});
  const campaigns=await readRows("/rest/v1/ifund_campaigns?select=id,owner_id&id=eq."+campaignId+"&owner_id=eq."+ownerId,api,env,fetcher);
  if(campaigns.length!==1||campaigns[0].id!==campaignId||campaigns[0].owner_id!==ownerId)
   return reply(404,{error:"Private document unavailable."});
  const rows=await readRows("/rest/v1/ifund_campaign_documents?select="+FIELDS+"&id=eq."+documentId+"&campaign_id=eq."+campaignId+"&owner_id=eq."+ownerId,api,env,fetcher);
  const row=rows[0];
  if(rows.length!==1||row?.id!==documentId||row?.owner_id!==ownerId||row?.campaign_id!==campaignId||
     row.object_store!=="r2"||row.deletion_requested_at!==null||!Object.hasOwn(TYPES,row.media_type)||
     !Number.isSafeInteger(row.file_size)||row.file_size<1||row.file_size>8*1024*1024||
     row.storage_path!==documentObjectKey({ownerId,campaignId,documentId,extension:TYPES[row.media_type]}))
   return reply(404,{error:"Private document unavailable."});
  const object=await verifiedPrivateDocumentRead({env,row:{...row,document_id:row.id},ownerId});
  // Revocation or reviewed deletion may begin while R2 is resolving the object.
  // Recheck the authoritative immutable receipt before releasing the stream.
  const discard=async()=>{try{await object.body?.cancel?.();}catch{/* denial stays final */}};
  try{
   if(!await eligible(api)){await discard();return reply(403,{error:"Your account can no longer access this document."});}
   const current=await readRows("/rest/v1/ifund_campaign_documents?select="+FIELDS+"&id=eq."+documentId+"&campaign_id=eq."+campaignId+"&owner_id=eq."+ownerId,api,env,fetcher);
   if(current.length!==1||FIELDS.split(",").some(field=>current[0]?.[field]!==row[field])){
    await discard();return reply(404,{error:"Private document unavailable."});
   }
  }catch(error){await discard();throw error;}
  return new Response(object.body,{status:200,headers:{
   "content-type":"application/octet-stream","content-disposition":"attachment",
   "content-length":String(row.file_size),"cache-control":"private, no-store",
   "x-content-type-options":"nosniff","referrer-policy":"no-referrer"
  }});
 }catch(error){
  const status=[401,403].includes(error?.status)?error.status:503;
  return reply(status,{error:status===503?"Private document could not be independently verified.": "Sign in with an authorized account."});
 }
}
