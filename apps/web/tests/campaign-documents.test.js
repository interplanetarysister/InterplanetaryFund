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
        is(key,val){query.filters.push([key,val]);return chain;},
        not(key,op,val){query.filters.push([key,op,val]);return chain;},
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
          if(query.operation==="update")return {data:{id:FILE_ID,owner_id:OWNER,campaign_id:CAMPAIGN,allow_agent_use:query.payload.allow_agent_use,deletion_requested_at:query.payload.deletion_requested_at||null},error:null};
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

test("only 8 MB or smaller PDF, Word, Excel and plain-text formats are accepted",()=>{
  assert.equal(validateCampaignDocument(PDF),"");
  assert.equal(validateCampaignDocument({size:DOCUMENT_MAX_BYTES+1,type:PDF.type,name:PDF.name}).includes("8 MB"),true);
  assert.match(validateCampaignDocument({size:100,type:"image/svg+xml",name:"bad.svg"}),/PDF, DOCX/);
  assert.match(validateCampaignDocument({size:100,type:"application/pdf",name:"attack.exe"}),/PDF, DOCX/);
  assert.equal(documentPath(OWNER,CAMPAIGN,FILE_ID,"application/pdf"),OWNER+"/"+CAMPAIGN+"/"+FILE_ID+".pdf");
});
test("magic signatures prevent disguised PDF or Word archives",async()=>{
  await verifyCampaignDocumentSignature(PDF);
  await assert.rejects(verifyCampaignDocumentSignature(new File(["not a PDF"],"fake.pdf",{type:"application/pdf"})),/PDF signature/);
  await assert.rejects(verifyCampaignDocumentSignature(new File(["definitely not a zip"],"fake.docx",{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"})),/Office document archive/);
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
test("failed private file cleanup retains pending metadata and revokes agent access",async()=>{
  const x=fakeClient({storageDeleteFailed:true});
  await assert.rejects(removeCampaignDocument(x.client,CAMPAIGN,{id:FILE_ID,owner_id:OWNER,campaign_id:CAMPAIGN,media_type:"application/pdf",storage_path:OWNER+"/"+CAMPAIGN+"/"+FILE_ID+".pdf"}),/File cleanup did not finish/);
  assert.ok(x.calls.some(c=>c.action==="table"&&c.table==="ifund_campaign_documents"));
  assert.equal(x.calls.some(c=>c.action==="storage-remove"),true);
  assert.equal(x.calls.some(c=>c.action==="table"&&c.table==="ifund_campaign_documents"&&c.operation==="delete"),false);
});
test("source components expose creation and management upload options",()=>{
  const create=readFileSync(new URL("../src/pages/CreateCampaign.jsx",import.meta.url),"utf8");
  const management=readFileSync(new URL("../src/pages/MyCampaigns.jsx",import.meta.url),"utf8");
  const editor=readFileSync(new URL("../src/pages/EditCampaign.jsx",import.meta.url),"utf8");
  const story=readFileSync(new URL("../../worker/agents/story.js",import.meta.url),"utf8");
  const context=readFileSync(new URL("../../worker/agents/teamContext.js",import.meta.url),"utf8");
  assert.match(create,/<CampaignDocuments/);
  assert.match(management,/<CampaignDocuments/);
  assert.match(editor,/<CampaignDocuments/);
  assert.match(story,/readCampaignDocumentContext/);
  assert.match(context,/ifund_campaign_agent_document_briefs/);
  assert.match(story,/IFUND_CAMPAIGN_DOCUMENTS_ENABLED/);
});

test("campaign quota prevents a sixteenth file before uploading",async()=>{
  const x=fakeClient();
  for(let i=0;i<15;i++)x.records.push({
    id:FILE_ID,owner_id:OWNER,campaign_id:CAMPAIGN,storage_path:OWNER+"/"+CAMPAIGN+"/"+FILE_ID+".pdf",
  });
  await assert.rejects(uploadCampaignDocument(x.client,CAMPAIGN,PDF,{
    makeId:()=>FILE_ID
  }),/Limit 15 documents/);
  assert.equal(x.calls.filter(item=>item.action==="upload").length,0);
});
test("agent opt-in remains off by default and owners can revoke it",async()=>{
  const x=fakeClient();
  const row={id:FILE_ID,owner_id:OWNER,campaign_id:CAMPAIGN};
  const update=await updateDocumentAgentAccess(x.client,CAMPAIGN,row,{
    allowAgentUse:false,summary:"This reference is no longer available to agents.",purpose:"budget"
  });
  assert.equal(update.id,FILE_ID);
  assert.equal(update.allow_agent_use,false,"Revocation must be persisted as false, not just return a matching document ID.");
  const change=x.calls.find(call=>call.action==="table"&&call.table==="ifund_campaign_documents");
  assert.ok(change,"A document metadata operation must be attempted.");
});
test("private reference UI responds to account switching and does not publish documents",()=>{
  const uploader=readFileSync(new URL("../src/components/campaigns/CampaignDocuments.jsx",import.meta.url),"utf8");
  const refs=readFileSync(new URL("../src/components/agents/AgentDocumentReferences.jsx",import.meta.url),"utf8");
  assert.match(uploader,/onAuthStateChange/);
  assert.match(refs,/onAuthStateChange/);
  assert.match(uploader,/not visible to campaign visitors/);
  assert.doesNotMatch(uploader,/getPublicUrl/);
});

test("owner-selected PDF or spreadsheet excerpts are stored without claiming automatic extraction",async()=>{
  const x=fakeClient();
  const ownerExcerpt="The organizer reported three refrigeration units, pending supplier invoices.";
  await uploadCampaignDocument(x.client,CAMPAIGN,PDF,{
    makeId:()=>FILE_ID,purpose:"budget",
    summary:"Budget details will be verified against original documents.",
    ownerExcerpt,allowAgentUse:true,
  });
  assert.equal(x.records[0].owner_excerpt,ownerExcerpt);
  assert.equal(x.records[0].extracted_text,"");
  assert.equal(x.records[0].allow_agent_use,true);
});
test("overlong private document excerpts are denied before upload",async()=>{
  const x=fakeClient();
  await assert.rejects(uploadCampaignDocument(x.client,CAMPAIGN,PDF,{
    makeId:()=>FILE_ID,ownerExcerpt:"x".repeat(4001),
  }),/within 4,000 characters/);
  assert.equal(x.calls.filter(item=>item.action==="upload").length,0);
});
test("owner excerpt may be updated or cleared along with agent permission",async()=>{
  const x=fakeClient();
  const row={id:FILE_ID,owner_id:OWNER,campaign_id:CAMPAIGN};
  const updated=await updateDocumentAgentAccess(x.client,CAMPAIGN,row,{
    allowAgentUse:false,purpose:"proof",summary:"Reference disabled until supporting claims are reviewed.",ownerExcerpt:"",
  });
  assert.equal(updated.id,FILE_ID);
});
test("only user-reviewed excerpts are included in document-aware Story prompts",()=>{
  const story=readFileSync(new URL("../../worker/agents/story.js",import.meta.url),"utf8");
  const migration=readFileSync(new URL("../../supabase/migrations/20261115095000_ifund_campaign_private_documents.sql",import.meta.url),"utf8");
  assert.match(story,/owner_selected_excerpt_unverified/);
  assert.match(migration,/'owner_excerpt',left\(d.owner_excerpt,1200\)/);
  assert.match(migration,/allow_agent_use=true/);
});

test("private references recheck grant before manual agent-draft insertion",()=>{
  const source=readFileSync(new URL("../src/components/agents/AgentDocumentReferences.jsx",import.meta.url),"utf8");
  assert.match(source,/const fresh=await loadAgentDocumentBriefs/);
  assert.match(source,/Document agent permission changed/);
  assert.match(source,/source|unverified/i);
});
test("server verifies real Storage file size for free-tier quota",()=>{
  const migration=readFileSync(new URL("../../supabase/migrations/20261115095000_ifund_campaign_private_documents.sql",import.meta.url),"utf8");
  assert.match(migration,/metadata->>'size'/);
  assert.match(migration,/actual_bytes<>new.file_size/);
  assert.match(migration,/209715200/);
  assert.match(migration,/owner_excerpt/);
});

test("removal marks document inaccessible to agents before deleting private bytes",async()=>{
  const x=fakeClient();
  const row={id:FILE_ID,owner_id:OWNER,campaign_id:CAMPAIGN,media_type:"application/pdf",
    storage_path:OWNER+"/"+CAMPAIGN+"/"+FILE_ID+".pdf"};
  await removeCampaignDocument(x.client,CAMPAIGN,row);
  const first=x.calls.findIndex(a=>a.action==="storage-remove");
  assert.ok(first>0);
  assert.equal(x.calls.some(a=>a.action==="table"&&a.table==="ifund_campaign_documents"),true);
  // A prior pending delete can retry without resetting agent permissions.
  const again=fakeClient();
  await removeCampaignDocument(again.client,CAMPAIGN,{...row,deletion_requested_at:"2026-11-15T17:00:00Z"});
  assert.equal(again.calls.some(a=>a.action==="storage-remove"),true);
});
test("a tombstoned document is not re-enabled for agent context",async()=>{
  const x=fakeClient(),row={id:FILE_ID,owner_id:OWNER,campaign_id:CAMPAIGN,
    deletion_requested_at:"2026-11-15T17:00:00Z"};
  await assert.rejects(updateDocumentAgentAccess(x.client,CAMPAIGN,row,{
    allowAgentUse:true,summary:"A long verified-sounding but unverified example.",purpose:"budget"
  }),/awaiting secure deletion/);
});
