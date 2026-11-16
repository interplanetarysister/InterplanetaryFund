// Private fundraising reference uploads. This intentionally does not use
// public campaign-cover storage and never publishes documents to supporters.
import { isVerifiedEmailUser } from "../lib/verifiedEmailUser.js";
import { payoutIdentity } from "../lib/guestAccess.js";
import { verifyAccountLifecycle } from "../lib/accountLifecycle.js";
import { loadOwnerCampaign } from "./ownerCampaigns.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DOCUMENT_BUCKET="ifund-campaign-documents";
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
export function documentPath(ownerId,campaignId,id,type) {
  return `${requireUUID(ownerId)}/${requireUUID(campaignId)}/${requireUUID(id)}.${DOCUMENT_FORMATS[type]||"invalid"}`;
}
export async function listCampaignDocuments(client,campaignId) {
  const userId=await owner(client,campaignId);
  const {data,error}=await client.from("ifund_campaign_documents")
    .select("id,owner_id,campaign_id,storage_path,file_name,media_type,file_size,purpose,agent_summary,owner_excerpt,allow_agent_use,deletion_requested_at,created_at")
    .eq("owner_id",userId).eq("campaign_id",campaignId)
    .order("created_at",{ascending:false}).limit(50);
  await unchanged(client,userId);
  if(error||!Array.isArray(data))throw Error("Your private document list is unavailable.");
  if(data.some(row=>row.owner_id!==userId||row.campaign_id!==campaignId))
    throw Error("The document list could not be verified for this account.");
  return data;
}
export async function uploadCampaignDocument(client,campaignId,file,{
  purpose="general",summary="",ownerExcerpt="",allowAgentUse=false,makeId=()=>crypto.randomUUID()
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
  const id=requireUUID(makeId(),"Could not generate a secure document identifier.");
  const path=documentPath(userId,campaignId,id,file.type);
  let extracted="";
  if(file.type.startsWith("text/")){
    extracted=(await file.slice(0,12000).text()).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g," ").slice(0,6000);
  }
  // File inspection and text extraction are asynchronous. Fail closed if the
  // authenticated account changed before any private Storage write begins.
  await unchanged(client,userId);
  const storage=client.storage.from(DOCUMENT_BUCKET);
  const {data:uploaded,error:uploadError}=await storage.upload(path,file,{
    contentType:file.type,cacheControl:"0",upsert:false
  });
  if(uploadError||uploaded?.path!==path)throw Error("Your private document could not be uploaded.");
  try{
    await unchanged(client,userId);
    const {data,error}=await client.from("ifund_campaign_documents").insert({
      id,owner_id:userId,campaign_id:campaignId,storage_path:path,
      file_name:sanitizedName(file.name),media_type:file.type,file_size:file.size,
      purpose,agent_summary:summary.trim(),owner_excerpt:ownerExcerpt.trim(),extracted_text:extracted,
      allow_agent_use:allowAgentUse
    }).select("id,owner_id,campaign_id").single();
    if(error?.code==="23514" && /Private document allowance reached/i.test(error.message||""))
      throw Error("Your private document storage is full (200 MB per account). Remove unused files.");
    if(error?.code==="23514" && /Campaign document limit reached/i.test(error.message||""))
      throw Error("This campaign already has 15 documents. Remove an older file.");
    if(error||data?.id!==id||data?.owner_id!==userId||data?.campaign_id!==campaignId)
      throw Error("The document record was not verified.");
    await unchanged(client,userId);
    return id;
  }catch(cause){
    const {error:cleanupError}=await storage.remove([path]);
    if(cleanupError)throw Error("The document record failed and private storage cleanup needs attention.");
    throw cause;
  }
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
export async function downloadPrivateCampaignDocument(client,campaignId,row){
  const userId=await owner(client,campaignId);
  if(row?.owner_id!==userId||row?.campaign_id!==campaignId||
    !UUID.test(row.id||"")||!DOCUMENT_FORMATS[row.media_type]||
    row.storage_path!==documentPath(userId,campaignId,row.id,row.media_type))
    throw Error("Document ownership could not be verified.");
  await unchanged(client,userId);
  const {data,error}=await client.storage.from(DOCUMENT_BUCKET).download(row.storage_path);
  await unchanged(client,userId);
  if(error||!data)throw Error("This private document could not be downloaded.");
  return data;
}
export async function removeCampaignDocument(client,campaignId,row){
  const userId=await owner(client,campaignId);
  if(row?.owner_id!==userId||row?.campaign_id!==campaignId||
    !UUID.test(row.id||"")||!DOCUMENT_FORMATS[row.media_type]||
    row.storage_path!==documentPath(userId,campaignId,row.id,row.media_type))
    throw Error("Document ownership could not be verified.");
  await unchanged(client,userId);
  // Stage 1: revoke agent use and persist deletion intent before any
  // irreversible Storage operation. Safe to retry after a network failure.
  if(!row.deletion_requested_at){
    const {data:marked,error:markError}=await client.from("ifund_campaign_documents")
      .update({allow_agent_use:false,deletion_requested_at:new Date().toISOString()})
      .eq("id",row.id).eq("owner_id",userId).eq("campaign_id",campaignId)
      .is("deletion_requested_at",null)
      .select("id,deletion_requested_at").single();
    await unchanged(client,userId);
    if(markError||marked?.id!==row.id||!marked.deletion_requested_at)
      throw Error("Private document deletion could not be scheduled safely.");
  }
  // Stage 2: remove bytes. A failed removal leaves a pending entry that is
  // invisible to all agent brief RPCs, and can be retried by the same owner.
  const privateStorage=client.storage.from(DOCUMENT_BUCKET);
  const {error:storageError}=await privateStorage.remove([row.storage_path]);
  await unchanged(client,userId);
  if(storageError)throw Error("File cleanup did not finish. Retry removal of the pending document.");
  // A successful DELETE receipt does not independently prove absence. Query
  // the same private object endpoint before removing the durable metadata row.
  // Only a specific NoSuchKey result establishes absence; generic 404s may
  // also represent a missing bucket or insufficient Storage authorization.
  if(typeof privateStorage.info!=="function")
    throw Error("Private file deletion needs independent Storage verification.");
  const {data:remaining,error:infoError}=await privateStorage.info(row.storage_path);
  await unchanged(client,userId);
  if(remaining||infoError?.code!=="NoSuchKey")
    throw Error("Private file absence could not be verified. Retry secure removal.");
  const {data,error}=await client.from("ifund_campaign_documents").delete()
    .eq("id",row.id).eq("owner_id",userId).eq("campaign_id",campaignId)
    .not("deletion_requested_at","is",null)
    .select("id").single();
  await unchanged(client,userId);
  if(error||data?.id!==row.id)throw Error("Private file deletion completed but its pending database entry needs cleanup. Retry removal.");
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
