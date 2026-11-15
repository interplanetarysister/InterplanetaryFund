// Private fundraising reference uploads. This intentionally does not use
// public campaign-cover storage and never publishes documents to supporters.
import { isVerifiedEmailUser } from "../lib/verifiedEmailUser.js";
import { payoutIdentity } from "../lib/guestAccess.js";
import { verifyAccountLifecycle } from "../lib/accountLifecycle.js";
import { loadOwnerCampaign } from "./ownerCampaigns.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DOCUMENT_BUCKET="ifund-campaign-documents";
export const DOCUMENT_MAX_BYTES=8*1024*1024;
export const DOCUMENT_FORMATS=Object.freeze({
  "application/pdf":"pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":"docx",
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
    return "Choose a PDF, DOCX, TXT, Markdown, or CSV document.";
  if(!sanitizedName(file.name))return "Choose a document with a valid name.";
  return "";
}
export async function verifyCampaignDocumentSignature(file) {
  const type=file.type;
  const header=new Uint8Array(await file.slice(0,8).arrayBuffer());
  if(type==="application/pdf" && String.fromCharCode(...header.slice(0,5))!=="%PDF-")
    throw Error("This file does not have a valid PDF signature.");
  if(type==="application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
     !(header[0]===0x50&&header[1]===0x4b&&[0x03,0x05,0x07].includes(header[2])))
    throw Error("This file does not appear to be a valid DOCX archive.");
  if(header.includes(0)&&type.startsWith("text/"))
    throw Error("This file contains binary data; choose a plain text document.");
}
async function owner(client,campaignId) {
  requireUUID(campaignId,"Save your campaign before attaching documents.");
  const {data,error}=await client.auth.getUser(),user=data?.user;
  if(error||!isVerifiedEmailUser(user)||!payoutIdentity(user)||!UUID.test(user?.id||""))
    throw Error("Sign in with a confirmed email account to manage campaign documents.");
  const lifecycle=await verifyAccountLifecycle(client,user);
  if(!lifecycle.ok)throw Error(lifecycle.message||"Your account could not be verified.");
  const campaign=await loadOwnerCampaign(client,campaignId);
  if(campaign.id!==campaignId)throw Error("The campaign could not be verified.");
  return user.id;
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
    .select("id,owner_id,campaign_id,storage_path,file_name,media_type,file_size,purpose,agent_summary,allow_agent_use,created_at")
    .eq("owner_id",userId).eq("campaign_id",campaignId)
    .order("created_at",{ascending:false}).limit(50);
  await unchanged(client,userId);
  if(error||!Array.isArray(data))throw Error("Your private document list is unavailable.");
  if(data.some(row=>row.owner_id!==userId||row.campaign_id!==campaignId))
    throw Error("The document list could not be verified for this account.");
  return data;
}
export async function uploadCampaignDocument(client,campaignId,file,{
  purpose="general",summary="",allowAgentUse=false,makeId=()=>crypto.randomUUID()
}={}){
  const problem=validateCampaignDocument(file);if(problem)throw Error(problem);
  if(!Object.hasOwn(DOCUMENT_CATEGORIES,purpose))throw Error("Choose a valid document category.");
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
      purpose,agent_summary:summary.trim(),extracted_text:extracted,
      allow_agent_use:allowAgentUse
    }).select("id,owner_id,campaign_id").single();
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
export async function updateDocumentAgentAccess(client,campaignId,row,{allowAgentUse,summary,purpose}){
  const userId=await owner(client,campaignId);
  if(!row||row.owner_id!==userId||row.campaign_id!==campaignId)
    throw Error("Only your own campaign documents can be changed.");
  if(!Object.hasOwn(DOCUMENT_CATEGORIES,purpose)||typeof summary!=="string"||summary.length>3000||
    (allowAgentUse&&summary.trim().length<20))throw Error("Review the summary before allowing agent access.");
  const {data,error}=await client.from("ifund_campaign_documents")
    .update({allow_agent_use:allowAgentUse===true,agent_summary:summary.trim(),purpose})
    .eq("id",row.id).eq("owner_id",userId).eq("campaign_id",campaignId)
    .select("id,owner_id,campaign_id,allow_agent_use").single();
  await unchanged(client,userId);
  if(error||data?.id!==row.id||data?.owner_id!==userId)throw Error("Document permissions were not saved.");
  return data;
}
export async function downloadPrivateCampaignDocument(client,campaignId,row){
  const userId=await owner(client,campaignId);
  if(row?.owner_id!==userId||row?.campaign_id!==campaignId||
    !row.storage_path?.startsWith(`${userId}/${campaignId}/`))
    throw Error("Document ownership could not be verified.");
  const {data,error}=await client.storage.from(DOCUMENT_BUCKET).download(row.storage_path);
  await unchanged(client,userId);
  if(error||!data)throw Error("This private document could not be downloaded.");
  return data;
}
export async function removeCampaignDocument(client,campaignId,row){
  const userId=await owner(client,campaignId);
  if(row?.owner_id!==userId||row?.campaign_id!==campaignId||
    !row.storage_path?.startsWith(`${userId}/${campaignId}/`))
    throw Error("Document ownership could not be verified.");
  const {error:storageError}=await client.storage.from(DOCUMENT_BUCKET).remove([row.storage_path]);
  if(storageError)throw Error("The private file could not be removed.");
  const {data,error}=await client.from("ifund_campaign_documents").delete()
    .eq("id",row.id).eq("owner_id",userId).eq("campaign_id",campaignId)
    .select("id").single();
  await unchanged(client,userId);
  if(error||data?.id!==row.id)throw Error("The file was removed, but its record needs cleanup.");
  return true;
}
