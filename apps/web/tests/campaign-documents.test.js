import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {
 DOCUMENT_BUCKET,DOCUMENT_MAX_BYTES,validateCampaignDocument,verifyCampaignDocumentSignature,
 documentPath,uploadCampaignDocument,listCampaignDocuments,downloadPrivateCampaignDocument,
 removeCampaignDocument,updateDocumentAgentAccess
} from "../src/api/campaignDocuments.js";
const OWNER="11111111-1111-4111-8111-111111111111",OTHER="22222222-2222-4222-8222-222222222222";
const CAMPAIGN="33333333-3333-4333-8333-333333333333",ID="44444444-4444-4444-8444-444444444444";
const PDF=new File([new TextEncoder().encode("%PDF-1.7\nExample budget")],"budget.pdf",{type:"application/pdf"});
const SHA=createHash("sha256").update("%PDF-1.7\nExample budget").digest("hex");
const path=documentPath(OWNER,CAMPAIGN,ID,PDF.type);
function fixture({owner=OWNER,documents=[]}={}){
 const calls=[];
 const user={id:owner,email_confirmed_at:"2026-11-26",is_anonymous:false};
 const auth={getUser:async()=>({data:{user},error:null}),
  getSession:async()=>({data:{session:{user,access_token:"valid-member-token-1234567890123"}},error:null}),
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})};
 const client={auth,
  storage:{from:()=>assert.fail("R2 private documents must never use Supabase Storage")},
  from(table){
   const query={filters:[],operation:"select",payload:null};
   const q={
    select(){return q;},eq(a,v){query.filters.push([a,v]);return q;},
    is(){return q;},not(){return q;},order(){return q;},limit(){return q;},
    update(values){query.operation="update";query.payload=values;return q;},
    maybeSingle:async()=>{
     if(table==="ifund_profiles")return {data:{account_status:"active",account_deletion_pending:false},error:null};
     if(table==="ifund_campaigns")return {data:{id:CAMPAIGN,owner_id:owner,status:"draft"},error:null};
     return {data:null,error:null};
    },
    single:async()=>({data:{id:ID,owner_id:owner,campaign_id:CAMPAIGN,
      ...query.payload,allow_agent_use:query.payload?.allow_agent_use??false},error:null}),
    then(resolve,reject){return Promise.resolve({data:documents,error:null}).then(resolve,reject);}
   };return q;
  }
 };
 return {client,calls,fetcher:async(url,opts)=>{
  calls.push({url,opts});
  if(opts.method==="POST"){
   assert.equal(url,"/api/media/documents/"+CAMPAIGN);
   assert.equal(opts.body,PDF);
   assert.equal(opts.headers["content-type"],PDF.type);
   return Response.json({id:ID,bytes:PDF.size,content_type:PDF.type,sha256:SHA},{status:201});
  }
  if(opts.method==="GET"){
   assert.equal(url,"/api/media/documents/"+CAMPAIGN+"/"+ID);
   return new Response(PDF,{headers:{"content-type":PDF.type,"x-ifund-document-sha256":SHA}});
  }
  if(opts.method==="DELETE"){
   assert.equal(url,"/api/media/documents/"+CAMPAIGN+"/"+ID);
   return new Response(null,{status:204});
  }
  throw Error("Unexpected media request");
 }};
}
const ownedRow={id:ID,owner_id:OWNER,campaign_id:CAMPAIGN,storage_path:path,
 media_type:PDF.type,file_size:PDF.size,object_store:"r2",
 object_sha256:SHA,object_etag:"etag-verified",deletion_requested_at:null};
test("document signatures and size constraints match R2 storage contract",async()=>{
 assert.equal(DOCUMENT_BUCKET,"ifund-media");
 assert.equal(DOCUMENT_MAX_BYTES,8388608);
 assert.equal(documentPath(OWNER,CAMPAIGN,ID,PDF.type),`private/campaign-documents/${OWNER}/${CAMPAIGN}/${ID}.pdf`);
 assert.equal(validateCampaignDocument(PDF),"");
 assert.match(validateCampaignDocument({size:DOCUMENT_MAX_BYTES+1,type:PDF.type,name:"too-big.pdf"}),/8 MB/);
 assert.match(validateCampaignDocument({size:200,type:"image/svg+xml",name:"bad.svg"}),/PDF/);
 await verifyCampaignDocumentSignature(PDF);
 await assert.rejects(verifyCampaignDocumentSignature(new File(["wrong"],"wrong.pdf",{type:PDF.type})),/PDF signature/);
});
test("owner can upload to private R2 Pages API; no public URL or browser Storage write",async()=>{
 const x=fixture();
 const id=await uploadCampaignDocument(x.client,CAMPAIGN,PDF,{fetcher:x.fetcher,summary:"Budget evidence reviewed by the owner."});
 assert.equal(id,ID);
 const meta=JSON.parse(decodeURIComponent(x.calls[0].opts.headers["x-ifund-document-meta"]));
 assert.equal(meta.allow_agent_use,false);
 assert.equal(meta.file_name,"budget.pdf");
 assert.ok(!JSON.stringify(x.calls).includes("service_role"));
 assert.equal(x.calls[0].opts.headers.origin,"https://interplanetaryfund.com");
});
test("consent requires owner-reviewed summary before uploading",async()=>{
 const x=fixture();
 await assert.rejects(uploadCampaignDocument(x.client,CAMPAIGN,PDF,{fetcher:x.fetcher,
  allowAgentUse:true,summary:"short"}),/at least 20 characters/);
 assert.equal(x.calls.length,0);
});
test("owner-only list rejects response containing another owner's record",async()=>{
 const x=fixture({documents:[{...ownedRow,owner_id:OTHER}]});
 await assert.rejects(listCampaignDocuments(x.client,CAMPAIGN),/could not be verified/);
});
test("download verifies R2 digest, MIME and byte count; no direct Storage access",async()=>{
 const x=fixture();
 const blob=await downloadPrivateCampaignDocument(x.client,CAMPAIGN,ownedRow,{fetcher:x.fetcher});
 assert.equal(blob.size,PDF.size);
 const broken=fixture();
 await assert.rejects(downloadPrivateCampaignDocument(broken.client,CAMPAIGN,
  {...ownedRow,object_sha256:"f".repeat(64)},{fetcher:broken.fetcher}),/integrity check/);
});
test("deletion only asks server to tombstone, remove bytes, verify absence then return 204",async()=>{
 const x=fixture();
 assert.equal(await removeCampaignDocument(x.client,CAMPAIGN,ownedRow,{fetcher:x.fetcher}),true);
 assert.equal(x.calls.length,1);
 assert.equal(x.calls[0].opts.method,"DELETE");
 assert.equal(x.calls[0].opts.headers.origin,"https://interplanetaryfund.com");
});
test("foreign or mismatched document identity is refused before any destructive request",async()=>{
 const x=fixture();
 for(const row of [{...ownedRow,owner_id:OTHER},{...ownedRow,storage_path:"private/other.pdf"}])
  await assert.rejects(removeCampaignDocument(x.client,CAMPAIGN,row,{fetcher:x.fetcher}),/ownership/);
 assert.equal(x.calls.length,0);
});
test("agent access is opt-in and pending deletion is irreversible",async()=>{
 const x=fixture(),pending={...ownedRow,deletion_requested_at:"2026-11-26"};
 await assert.rejects(updateDocumentAgentAccess(x.client,CAMPAIGN,pending,{
  allowAgentUse:true,purpose:"proof",summary:"Review these owner supplied proof details before sharing."
 }),/awaiting secure deletion/);
});
test("all campaign entrypoints expose owner-scoped private documents",()=>{
 for(const path of ["../src/pages/CreateCampaign.jsx","../src/pages/MyCampaigns.jsx","../src/pages/CampaignWorkspace.jsx"]){
  const source=readFileSync(new URL(path,import.meta.url),"utf8");
  assert.match(source,/<CampaignDocuments/);
 }
 const availability=readFileSync(new URL("../src/lib/campaignDocumentAvailability.mjs",import.meta.url),"utf8");
 assert.match(availability,/CAMPAIGN_DOCUMENTS_ACTIVE = true/);
 const server=readFileSync(new URL("../../../worker/media/privateDocuments.js",import.meta.url),"utf8");
 assert.match(server,/ifund_campaign_document_upload_permitted/);
 assert.match(server,/object_sha256/);
 assert.match(server,/deletion_requested_at/);
 assert.match(server,/bucket\.head\(doc.storage_path\)/);
});
