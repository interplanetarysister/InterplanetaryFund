import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  DOCUMENT_BUCKET,DOCUMENT_MAX_BYTES,validateCampaignDocument,
  verifyCampaignDocumentSignature,documentPath,uploadCampaignDocument,
  listCampaignDocuments,updateDocumentAgentAccess,removeCampaignDocument
} from "../src/api/campaignDocuments.js";

const OWNER="11111111-1111-4111-8111-111111111111";
const CAMPAIGN="22222222-2222-4222-8222-222222222222";
const FILE_ID="33333333-3333-4333-8333-333333333333";
const PDF=new File([new TextEncoder().encode("%PDF-1.7\nExample campaign budget")],"budget.pdf",{type:"application/pdf"});
function fakeClient({user={id:OWNER,email_confirmed_at:"2026-11-15T12:00:00Z",is_anonymous:false},
 uploadFailed=false,insertFailed=false,storageDeleteFailed=false}={}){
  const calls=[],records=[];
  const storage={
    upload:async(path,_file,options)=>{
      calls.push({action:"upload",path,options});
      return uploadFailed?{data:null,error:{message:"rejected"}}:{data:{path},error:null};
    },
    remove:async paths=>{
      calls.push({action:"storage-remove",paths});
      return storageDeleteFailed?{error:{message:"blocked"}}:{error:null};
    }
  };
  const client={
    auth:{getUser:async()=>({data:{user},error:null})},
    storage:{from:bucket=>{assert.equal(bucket,DOCUMENT_BUCKET);return storage;}},
    from(table){
      calls.push({action:"table",table});
      const query={table,filters:[],payload:null,operation:"select"};
      const chain={
        select(){return chain;},eq(key,val){query.filters.push([key,val]);return chain;},
        order(){return chain;},limit(){return chain;},
        insert(payload){query.operation="insert";query.payload=payload;calls.push({action:"insert",payload});return chain;},
        update(payload){query.operation="update";query.payload=payload;return chain;},
        delete(){query.operation="delete";return chain;},
        maybeSingle:async()=>{
          if(table==="ifund_profiles")return {data:{account_status:"active",account_deletion_pending:false},error:null};
          if(table==="ifund_campaigns")return {data:{id:CAMPAIGN,owner_id:OWNER,status:"draft"},error:null};
          return {data:null,error:null};
        },
        single:async()=>{
          if(query.operation==="insert"){
            if(insertFailed)return {data:null,error:{message:"metadata rejected"}};
            records.push(query.payload);
            return {data:{id:query.payload.id,owner_id:query.payload.owner_id,campaign_id:query.payload.campaign_id},error:null};
          }
          if(query.operation==="update")return {data:{id:FILE_ID,owner_id:OWNER,campaign_id:CAMPAIGN,allow_agent_use:true},error:null};
          if(query.operation==="delete")return {data:{id:FILE_ID},error:null};
          return {data:null,error:null};
        },
        then(resolve,reject){
          return Promise.resolve({data:records.map(r=>({...r})),error:null}).then(resolve,reject);
        }
      };
      return chain;
    }
  };
  return {client,calls,records};
}

test("only 8 MB or smaller PDF, DOCX and plain-text formats are accepted",()=>{
  assert.equal(validateCampaignDocument(PDF),"");
  assert.equal(validateCampaignDocument({size:DOCUMENT_MAX_BYTES+1,type:PDF.type,name:PDF.name}).includes("8 MB"),true);
  assert.match(validateCampaignDocument({size:100,type:"image/svg+xml",name:"bad.svg"}),/PDF, DOCX/);
  assert.match(validateCampaignDocument({size:100,type:"application/pdf",name:"attack.exe"}),/PDF, DOCX/);
  assert.equal(documentPath(OWNER,CAMPAIGN,FILE_ID,"application/pdf"),OWNER+"/"+CAMPAIGN+"/"+FILE_ID+".pdf");
});
test("magic signatures prevent disguised PDF or Word archives",async()=>{
  await verifyCampaignDocumentSignature(PDF);
  await assert.rejects(verifyCampaignDocumentSignature(new File(["not a PDF"],"fake.pdf",{type:"application/pdf"})),/PDF signature/);
  await assert.rejects(verifyCampaignDocumentSignature(new File(["definitely not a zip"],"fake.docx",{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"})),/DOCX archive/);
});
test("private upload has no public URL and owner-scoped path and defaults to no AI access",async()=>{
  const x=fakeClient();
  const id=await uploadCampaignDocument(x.client,CAMPAIGN,PDF,{makeId:()=>FILE_ID,summary:"Campaign financial reference for owner review."});
  assert.equal(id,FILE_ID);
  assert.ok(x.calls.some(c=>c.action==="upload"&&c.path===OWNER+"/"+CAMPAIGN+"/"+FILE_ID+".pdf"&&c.options.upsert===false));
  assert.equal(x.records[0].allow_agent_use,false);
  assert.equal(x.records[0].storage_path,OWNER+"/"+CAMPAIGN+"/"+FILE_ID+".pdf");
  assert.equal(x.records[0].agent_summary,"Campaign financial reference for owner review.");
  assert.ok(!x.calls.some(c=>c.action==="getPublicUrl"));
});
test("explicit owner opt-in and adequate summary required for agent references",async()=>{
  const x=fakeClient();
  await assert.rejects(uploadCampaignDocument(x.client,CAMPAIGN,PDF,{makeId:()=>FILE_ID,allowAgentUse:true,summary:"short"}),/at least 20 characters/);
  assert.ok(!x.calls.some(c=>c.action==="upload"));
  await uploadCampaignDocument(x.client,CAMPAIGN,PDF,{makeId:()=>FILE_ID,allowAgentUse:true,summary:"Owner-approved document facts for campaign messaging."});
  assert.equal(x.records[0].allow_agent_use,true);
});
test("metadata insert failure removes private uploaded object",async()=>{
  const x=fakeClient({insertFailed:true});
  await assert.rejects(uploadCampaignDocument(x.client,CAMPAIGN,PDF,{makeId:()=>FILE_ID}),/not verified/);
  assert.equal(x.calls.filter(c=>c.action==="storage-remove").length,1);
});
test("storage reject never creates misleading document record",async()=>{
  const x=fakeClient({uploadFailed:true});
  await assert.rejects(uploadCampaignDocument(x.client,CAMPAIGN,PDF,{makeId:()=>FILE_ID}),/could not be uploaded/);
  assert.equal(x.calls.filter(c=>c.action==="insert").length,0);
});
test("unverified member or anonymous guest cannot upload",async()=>{
  const x=fakeClient({user:{id:OWNER,email_confirmed_at:null,is_anonymous:true}});
  await assert.rejects(uploadCampaignDocument(x.client,CAMPAIGN,PDF,{makeId:()=>FILE_ID}),/confirmed email/);
  assert.equal(x.calls.filter(c=>c.action==="upload").length,0);
});
test("owner refuses a document row with foreign account",async()=>{
  const x=fakeClient();
  await assert.rejects(updateDocumentAgentAccess(x.client,CAMPAIGN,{id:FILE_ID,owner_id:"44444444-4444-4444-8444-444444444444",campaign_id:CAMPAIGN},{allowAgentUse:true,summary:"Verified spending document for review.",purpose:"budget"}),/own campaign/);
});
test("deleted object failure retains the document record",async()=>{
  const x=fakeClient({storageDeleteFailed:true});
  await assert.rejects(removeCampaignDocument(x.client,CAMPAIGN,{id:FILE_ID,owner_id:OWNER,campaign_id:CAMPAIGN,storage_path:OWNER+"/"+CAMPAIGN+"/"+FILE_ID+".pdf"}),/could not be removed/);
  assert.equal(x.calls.some(c=>c.action==="table"&&c.table==="ifund_campaign_documents"&&c.operation==="delete"),false);
});
test("source components expose creation and management upload options",()=>{
  const create=readFileSync(new URL("../src/pages/CreateCampaign.jsx",import.meta.url),"utf8");
  const management=readFileSync(new URL("../src/pages/MyCampaigns.jsx",import.meta.url),"utf8");
  const story=readFileSync(new URL("../../worker/agents/story.js",import.meta.url),"utf8");
  assert.match(create,/<CampaignDocuments/);
  assert.match(management,/<CampaignDocuments/);
  assert.match(story,/ifund_campaign_agent_document_briefs/);
  assert.match(story,/IFUND_CAMPAIGN_DOCUMENTS_ENABLED/);
});
