// Private fundraising reference uploads. This intentionally does not use
// public campaign-cover storage and never publishes documents to supporters.
import { isVerifiedEmailUser } from "../lib/verifiedEmailUser.js";
import { payoutIdentity } from "../lib/guestAccess.js";
import { verifyAccountLifecycle } from "../lib/accountLifecycle.js";
import { loadOwnerCampaign } from "./ownerCampaigns.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DOCUMENT_BUCKET="ifund-media"; // Canonical private Cloudflare R2 bucket.
export const DOCUMENT_MAX_BYTES=8*1024*1024;
export const DOCUMENT_FORMATS=Object.freeze({
  "application/pdf":"pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":"docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"xlsx",
  "text/plain":"txt","text/markdown":"md","text/csv":"csv"
});
export const DOCUMENT_CATEGORIES=Object.freeze({
  general:"General reference",budget:"Budget and spending",proof:"Supporting evidence",
  research:"Research and resources",planning:"Campaign planning",
  outreach:"Outreach and contacts",media:"Marketing reference"
});
function requireUUID(value,label="Invalid identifier.") {
  if(!UUID.test(value||""))throw Error(label);
  return value;
}
function sanitizedName(value) {
  return String(value||"").replace(/[\\/\u0000-\u001f\u007f]/g," ").trim().slice(0,160);
}
export function validateCampaignDocument(file) {
  if(!file||typeof file.size!=="number"||file.size<1||file.size>DOCUMENT_MAX_BYTES)
    return "Choose a nonempty document smaller than 8 MB.";
  const extension=DOCUMENT_FORMATS[file.type];
  if(!extension||!String(file.name||"").toLowerCase().endsWith("."+extension))
    return "Choose a PDF, DOCX, XLSX, TXT, Markdown, or CSV document.";
  if(!sanitizedName(file.name))return "Choose a document with a valid name.";
  return "";
}
export async function verifyCampaignDocumentSignature(file) {
  const type=file.type;
  const header=new Uint8Array(await file.slice(0,8).arrayBuffer());
  if(type==="application/pdf" && String.fromCharCode(...header.slice(0,5))!=="%PDF-")
    throw Error("This file does not have a valid PDF signature.");
  if(["application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].includes(type) &&
     !(header[0]===0x50&&header[1]===0x4b&&[0x03,0x05,0x07].includes(header[2])))
    throw Error("This file does not appear to be a valid Office document archive.");
  if(header.includes(0)&&type.startsWith("text/"))
    throw Error("This file contains binary data; choose a plain text document.");
}
async function verifiedDocumentOwner(client) {
  const {data,error}=await client.auth.getUser(),user=data?.user;
  if(error||!isVerifiedEmailUser(user)||!payoutIdentity(user)||!UUID.test(user?.id||""))
    throw Error("Sign in with a confirmed email account to manage campaign documents.");
  const lifecycle=await verifyAccountLifecycle(client,user);
  if(!lifecycle.ok)throw Error(lifecycle.message||"Your account could not be verified.");
  return user.id;
}
async function owner(client,campaignId) {
  requireUUID(campaignId,"Save your campaign before attaching documents.");
  const userId=await verifiedDocumentOwner(client);
  const campaign=await loadOwnerCampaign(client,campaignId);
  if(campaign.id!==campaignId)throw Error("The campaign could not be verified.");
  await unchanged(client,userId);
  return userId;
}
async function unchanged(client,ownerId) {
  const {data,error}=await client.auth.getUser();
  if(error||data?.user?.id!==ownerId)throw Error("Your account changed. Reopen your campaign documents.");
}
// Private document bytes travel only through the same-origin, member-authenticated
// Pages Function. File metadata and agent permissions remain Supabase RLS-owned.
function privateMediaPath(campaignId,suffix=""){
  return "/api/media/documents/"+requireUUID(campaignId)+(suffix?"/"+suffix:"");
}
async function verifiedPrivateMediaResponse(client,ownerId,path,{
  method="GET",file,metadata,fetcher=fetch,origin=globalThis.location?.origin||"https://interplanetaryfund.com"
}={}){
  const session=await client.auth.getSession();
  if(session.error||session.data?.session?.user?.id!==ownerId||!session.data.session.access_token)
    throw Error("Your account changed before the private media request.");
  const headers={authorization:"Bearer "+session.data.session.access_token};
  if(method==="POST"){
    headers["content-type"]=file.type;
    headers["x-ifund-document-meta"]=encodeURIComponent(JSON.stringify(metadata));
    headers.origin=new URL(origin).origin;
  }
  if(method==="DELETE")headers.origin=new URL(origin).origin;
  const response=await fetcher(path,{method,headers,...(file?{body:file}:{}),signal:AbortSignal.timeout(35000)});
  await unchanged(client,ownerId);
  if(!response.ok){
    const value=await response.json().catch(()=>null);
    throw Error(typeof value?.error==="string"?value.error.slice(0,280):"Private media is temporarily unavailable.");
  }
  return response;
}
export function documentPath(ownerId,campaignId,id,type) {
  return `private/campaign-documents/${requireUUID(ownerId)}/${requireUUID(campaignId)}/${requireUUID(id)}.${DOCUMENT_FORMATS[type]||"invalid"}`;
}
export async function listCampaignDocuments(client,campaignId) {
  const userId=await owner(client,campaignId);
  const {data,error}=await client.from("ifund_campaign_documents")
    .select("id,owner_id,campaign_id,storage_path,file_name,media_type,file_size,object_store,object_etag,object_sha256,purpose,agent_summary,owner_excerpt,allow_agent_use,deletion_requested_at,created_at")
    .eq("owner_id",userId).eq("campaign_id",campaignId)
    .order("created_at",{ascending:false}).limit(50);
  await unchanged(client,userId);
  if(error||!Array.isArray(data))throw Error("Your private document list is unavailable.");
  if(data.some(row=>row.owner_id!==userId||row.campaign_id!==campaignId))
    throw Error("The document list could not be verified for this account.");
  return data;
}
export async function uploadCampaignDocument(client,campaignId,file,{
  purpose="general",summary="",ownerExcerpt="",allowAgentUse=false,fetcher=fetch
}={}){
  const problem=validateCampaignDocument(file);if(problem)throw Error(problem);
  if(!Object.hasOwn(DOCUMENT_CATEGORIES,purpose))throw Error("Choose a valid document category.");
  if(typeof ownerExcerpt!=="string"||ownerExcerpt.length>4000)
    throw Error("Keep important document excerpts within 4,000 characters.");
  if(typeof summary!=="string"||summary.length>3000||(allowAgentUse&&summary.trim().length<20))
    throw Error("Add at least 20 characters describing this document before sharing it with the agent team.");
  const userId=await owner(client,campaignId);
  const listed=await listCampaignDocuments(client,campaignId);
  if(listed.length>=15)throw Error("Limit 15 documents per campaign. Remove unused files before uploading more.");
  await verifyCampaignDocumentSignature(file);
  await unchanged(client,userId);
  const response=await verifiedPrivateMediaResponse(client,userId,privateMediaPath(campaignId),{
    method:"POST",file,fetcher,metadata:{file_name:sanitizedName(file.name),purpose,
      summary,owner_excerpt:ownerExcerpt,allow_agent_use:allowAgentUse===true}
  });
  if(response.status!==201)throw Error("Private media upload did not return a verified receipt.");
  const data=await response.json().catch(()=>null);
  if(!UUID.test(data?.id||"")||data.bytes!==file.size||data.content_type!==file.type||
    !/^[a-f0-9]{64}$/.test(data.sha256||""))
    throw Error("Private media upload receipt could not be verified.");
  await unchanged(client,userId);
  return data.id;
}
export async function updateDocumentAgentAccess(client,campaignId,row,{allowAgentUse,summary,purpose,ownerExcerpt=""}){
  const userId=await owner(client,campaignId);
  if(!row||row.owner_id!==userId||row.campaign_id!==campaignId)
    throw Error("Only your own campaign documents can be changed.");
  if(row.deletion_requested_at)throw Error("This document is awaiting secure deletion.");
  if(!Object.hasOwn(DOCUMENT_CATEGORIES,purpose)||typeof summary!=="string"||summary.length>3000||
    typeof ownerExcerpt!=="string"||ownerExcerpt.length>4000||
    (allowAgentUse&&summary.trim().length<20))throw Error("Review the summary before allowing agent access.");
  // Async owner/campaign verification above can outlive a session switch.
  // Recheck immediately before changing consent or the owner's reference text.
  await unchanged(client,userId);
  const {data,error}=await client.from("ifund_campaign_documents")
    .update({allow_agent_use:allowAgentUse===true,agent_summary:summary.trim(),owner_excerpt:ownerExcerpt.trim(),purpose})
    .eq("id",row.id).eq("owner_id",userId).eq("campaign_id",campaignId)
    .is("deletion_requested_at",null)
    .select("id,owner_id,campaign_id,allow_agent_use").single();
  await unchanged(client,userId);
  if(error||data?.id!==row.id||data?.owner_id!==userId)throw Error("Document permissions were not saved.");
  return data;
}
export async function downloadPrivateCampaignDocument(client,campaignId,row,{fetcher=fetch}={}){
  const userId=await owner(client,campaignId);
  if(row?.owner_id!==userId||row?.campaign_id!==campaignId||!UUID.test(row.id||"")||
    !DOCUMENT_FORMATS[row.media_type]||row.storage_path!==documentPath(userId,campaignId,row.id,row.media_type)||
    !/^[a-f0-9]{64}$/.test(row.object_sha256||"")||row.deletion_requested_at)
    throw Error("Document ownership or integrity could not be verified.");
  const response=await verifiedPrivateMediaResponse(client,userId,privateMediaPath(campaignId,row.id),{fetcher});
  const blob=await response.blob();
  const header=response.headers.get("x-ifund-document-sha256");
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await blob.arrayBuffer())),v=>v.toString(16).padStart(2,"0")).join("");
  if(blob.size!==row.file_size||header!==row.object_sha256||digest!==row.object_sha256||
    response.headers.get("content-type")!==row.media_type)
    throw Error("Private document download failed its integrity check.");
  await unchanged(client,userId);
  return blob;
}
export async function removeCampaignDocument(client,campaignId,row,{fetcher=fetch}={}){
  const userId=await owner(client,campaignId);
  if(row?.owner_id!==userId||row?.campaign_id!==campaignId||!UUID.test(row.id||"")||
    !DOCUMENT_FORMATS[row.media_type]||row.storage_path!==documentPath(userId,campaignId,row.id,row.media_type))
    throw Error("Document ownership could not be verified.");
  const response=await verifiedPrivateMediaResponse(client,userId,privateMediaPath(campaignId,row.id),{
    method:"DELETE",fetcher
  });
  if(response.status!==204)throw Error("Private media deletion did not return a verified absence receipt.");
  return true;
}
/** Owner-only, per-document opt-in facts usable by manual and AI agent tools. */
export async function loadAgentDocumentBriefs(client,campaignId){
  const ownerId=await owner(client,campaignId);
  const {data,error}=await client.rpc("ifund_campaign_agent_document_briefs",{
    p_campaign_id:campaignId
  });
  await unchanged(client,ownerId);
  if(error||!Array.isArray(data))throw Error("Agent document references are unavailable.");
  if(data.some(item=>!UUID.test(item.document_id||"")||
    typeof item.summary!=="string"||item.summary.length>3000||
    typeof item.purpose!=="string"||typeof item.file_name!=="string"||item.file_name.length>160))
    throw Error("The campaign reference list could not be verified.");
  return data.slice(0,6);
}

/** Owner-only global control surface for My Account / Manage Permissions. */
export async function listOwnerDocumentPermissions(client,{offset=0,limit=40}={}){
  if(!Number.isSafeInteger(offset)||offset<0||offset>100000||
     !Number.isSafeInteger(limit)||limit<1||limit>100)
    throw Error("Invalid private document page.");
  const userId=await verifiedDocumentOwner(client);
  const {data,error}=await client.from("ifund_campaign_documents")
    .select("id,owner_id,campaign_id,file_name,purpose,agent_summary,owner_excerpt,allow_agent_use,deletion_requested_at,created_at")
    .eq("owner_id",userId)
    .order("created_at",{ascending:false})
    .order("id",{ascending:false})
    .range(offset,offset+limit-1);
  await unchanged(client,userId);
  if(error||!Array.isArray(data)||data.some(row=>
    row.owner_id!==userId||!UUID.test(row.id||"")||!UUID.test(row.campaign_id||"")))
    throw Error("Your document permission records could not be verified.");
  return data;
}
/** Immediate account-wide revocation; preserves private files and per-file notes. */
export async function revokeAllOwnerDocumentAgentUse(client){
  const userId=await verifiedDocumentOwner(client);
  await unchanged(client,userId);
  // A single SECURITY INVOKER RPC updates all eligible rows atomically.
  // Unlike .update(...).select(), it never mistakes a capped REST response
  // for the total number of private documents whose consent was revoked.
  const {data,error}=await client.rpc("ifund_campaign_documents_revoke_all_agent_use");
  await unchanged(client,userId);
  if(error||!Number.isSafeInteger(data)||data<0)
    throw Error("Account-wide document agent access could not be revoked.");
  return data;
}

const STORAGE_FILE=/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(pdf|docx|xlsx|txt|md|csv)$/i;
export async function findStaleCampaignDocumentUploads(client,campaignId,{fetcher=fetch}={}){
  const userId=await owner(client,campaignId);
  const response=await verifiedPrivateMediaResponse(client,userId,privateMediaPath(campaignId,"orphans"),{fetcher});
  const payload=await response.json().catch(()=>null);
  if(!Array.isArray(payload?.items)||payload.items.length>25||payload.items.some(row=>
    !STORAGE_FILE.test(row?.name||"")||
    row.path!==("private/campaign-documents/"+userId+"/"+campaignId+"/"+row.name)||
    typeof row.createdAt!=="string"||Number.isNaN(Date.parse(row.createdAt))))
    throw Error("Private incomplete-upload recovery list could not be verified.");
  return payload.items;
}
export async function removeStaleCampaignDocumentUpload(client,campaignId,storagePath,{fetcher=fetch}={}){
  const userId=await owner(client,campaignId);
  const prefix="private/campaign-documents/"+userId+"/"+campaignId+"/";
  if(typeof storagePath!=="string"||!storagePath.startsWith(prefix)||!STORAGE_FILE.test(storagePath.slice(prefix.length)))
    throw Error("Only an owned private campaign upload can be cleaned up.");
  const file=storagePath.slice(prefix.length);
  const response=await verifiedPrivateMediaResponse(client,userId,privateMediaPath(campaignId,"orphans/"+file),{
    method:"DELETE",fetcher
  });
  if(response.status!==204)throw Error("Private orphan cleanup could not be verified.");
  return true;
}
