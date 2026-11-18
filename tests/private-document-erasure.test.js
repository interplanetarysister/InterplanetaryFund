import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {cleanupPrivateCampaignDocuments,handlePrivateDocumentErasure} from "../worker/services/privateDocumentErasure.js";
const REQUEST="11111111-1111-4111-8111-111111111111";
const OWNER="22222222-2222-4222-8222-222222222222";
const CAMPAIGN="33333333-3333-4333-8333-333333333333";
const DOCUMENT="44444444-4444-4444-8444-444444444444";
const PATH=OWNER+"/"+CAMPAIGN+"/"+DOCUMENT+".pdf";
const ENV={IFUND_DOCUMENT_ERASURE_ENABLED:"enabled",SUPABASE_URL:"https://ssibsfmtodgximseeqsv.supabase.co",SUPABASE_SECRET_KEY:"server-only-example-key-not-real"};
const request=()=>new Request("https://ifund.example/api/services/admin/private-document-erasure",{
 method:"POST",headers:{authorization:"Bearer admin.jwt","content-type":"application/json"},body:JSON.stringify({request_id:REQUEST})
});
function service({status="reviewing",owner=OWNER,failAt="",path=PATH,alreadyPending=false,orphan=false,missingBytes=false,missingCode="NoSuchKey"}={}){
 const calls=[];let inventory=1;
 const fetcher=async(url,options)=>{
   const parsed=new URL(url);const method=options.method;
   calls.push({url:parsed.pathname,method,body:options.body,headers:options.headers});
   if(failAt && parsed.pathname.includes(failAt))return Response.json({error:"private upstream detail"},{status:500});
   if(parsed.pathname.includes("/rpc/ifund_super_admin_account_deletion_queue"))
     return Response.json([{request_id:REQUEST,request_status:status,requested_user_id:owner}]);
   if(parsed.pathname.includes("/rpc/ifund_super_admin_private_document_inventory")){
     return Response.json(inventory===0?[]:[{document_id:orphan?null:DOCUMENT,storage_path:path,
       deletion_requested_at:alreadyPending?"2026-11-15T10:00:00Z":null,
       storage_present:!missingBytes,metadata_present:!orphan}]);
   }
   if(parsed.pathname==="/rest/v1/ifund_campaign_documents" && method==="PATCH")
     return Response.json([{id:DOCUMENT,deletion_requested_at:"2026-11-15T10:00:00Z",allow_agent_use:false}]);
   if(parsed.pathname==="/storage/v1/object/ifund-campaign-documents" && method==="DELETE"){
     if(orphan)inventory=0;
     return Response.json([{name:path}]);
   }
   if(parsed.pathname.includes("/storage/v1/object/info/ifund-campaign-documents/"))
     return Response.json({code:missingCode,message:"not found"},{status:404});
   if(parsed.pathname==="/rest/v1/ifund_campaign_documents" && method==="DELETE"){
     inventory=0;return Response.json([{id:DOCUMENT}]);
   }
   throw Error("Unexpected mock operation: "+parsed.pathname+" "+method);
 };
 return {fetcher,calls};
}
test("disabled route never accesses accounts",async()=>{
 const res=await handlePrivateDocumentErasure(request(),{...ENV,IFUND_DOCUMENT_ERASURE_ENABLED:"disabled"},
  {fetcher:()=>assert.fail("No provider call permitted")});
 assert.equal(res.status,503);
});
test("reviewed deletion removes bytes before metadata, never financial records",async()=>{
 const s=service();
 const output=await cleanupPrivateCampaignDocuments({fetcher:s.fetcher,env:ENV,requestId:REQUEST,jwt:"admin.jwt"});
 assert.deepEqual(output,{verified:true,more_documents:false,documents_removed:1,account_deleted:false});
 const deleteStorage=s.calls.findIndex(c=>c.url==="/storage/v1/object/ifund-campaign-documents"&&c.method==="DELETE");
 const mark=s.calls.findIndex(c=>c.method==="PATCH");
 const deleteMetadata=s.calls.findIndex(c=>c.url==="/rest/v1/ifund_campaign_documents"&&c.method==="DELETE");
 assert.ok(mark>=0&&mark<deleteStorage&&deleteStorage<deleteMetadata);
 assert.equal(s.calls.some(c=>c.url.includes("finance")||c.url.includes("ledger")),false);
 const serviceCall=s.calls.find(c=>c.method==="DELETE"&&c.url==="/storage/v1/object/ifund-campaign-documents");
 assert.ok(serviceCall);
 assert.equal(serviceCall.headers.Authorization,undefined);
 assert.equal(serviceCall.headers.apikey,ENV.SUPABASE_SECRET_KEY);
 const adminRpc=s.calls.find(c=>c.url.endsWith("/rpc/ifund_super_admin_account_deletion_queue"));
 assert.equal(adminRpc.headers.Authorization,"Bearer admin.jwt");
});
test("unreviewed request cannot delete anything",async()=>{
 const s=service({status:"requested"});
 await assert.rejects(cleanupPrivateCampaignDocuments({fetcher:s.fetcher,env:ENV,requestId:REQUEST,jwt:"admin.jwt"}),/reviewed/);
 assert.equal(s.calls.some(c=>c.method==="DELETE"||c.method==="PATCH"),false);
});
test("foreign account object path blocked",async()=>{
 const s=service({path:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/"+CAMPAIGN+"/"+DOCUMENT+".pdf"});
 await assert.rejects(cleanupPrivateCampaignDocuments({fetcher:s.fetcher,env:ENV,requestId:REQUEST,jwt:"admin.jwt"}),/does not belong/);
 assert.equal(s.calls.some(c=>c.method==="DELETE"),false);
});
test("failed Storage removal cannot erase metadata",async()=>{
 const s=service({failAt:"/storage/v1/object/ifund-campaign-documents"});
 await assert.rejects(cleanupPrivateCampaignDocuments({fetcher:s.fetcher,env:ENV,requestId:REQUEST,jwt:"admin.jwt"}),/refused/);
 assert.equal(s.calls.some(c=>c.method==="DELETE"&&c.url==="/rest/v1/ifund_campaign_documents"),false);
});
test("pending deletion resumes without changing old consent",async()=>{
 const s=service({alreadyPending:true});
 const output=await cleanupPrivateCampaignDocuments({fetcher:s.fetcher,env:ENV,requestId:REQUEST,jwt:"admin.jwt"});
 assert.equal(output.documents_removed,1);
 assert.equal(s.calls.some(c=>c.method==="PATCH"),false);
});
test("sanitized endpoint response never exposes private user IDs",async()=>{
 const s=service();
 const res=await handlePrivateDocumentErasure(request(),ENV,{fetcher:s.fetcher});
 assert.equal(res.status,200);
 const body=await res.json();
 assert.equal(body.documents_removed,1);
 assert.equal(JSON.stringify(body).includes(OWNER),false);
 const denial=service({status:"requires_legal_retention"});
 const fail=await handlePrivateDocumentErasure(request(),ENV,{fetcher:denial.fetcher});
 assert.equal(fail.status,503);
 assert.equal((await fail.text()).includes(OWNER),false);
});

test("orphan object without metadata is erased for the reviewed owner",async()=>{
 const s=service({orphan:true});
 const result=await cleanupPrivateCampaignDocuments({fetcher:s.fetcher,env:ENV,requestId:REQUEST,jwt:"admin.jwt"});
 assert.equal(result.documents_removed,1);
 assert.equal(s.calls.some(c=>c.method==="PATCH"),false);
 assert.equal(s.calls.some(c=>c.method==="DELETE"&&c.url==="/rest/v1/ifund_campaign_documents"),false);
 assert.equal(s.calls.some(c=>c.method==="DELETE"&&c.url==="/storage/v1/object/ifund-campaign-documents"),true);
});
test("stale metadata without bytes is independently cleaned up",async()=>{
 const s=service({missingBytes:true});
 const result=await cleanupPrivateCampaignDocuments({fetcher:s.fetcher,env:ENV,requestId:REQUEST,jwt:"admin.jwt"});
 assert.equal(result.documents_removed,1);
 assert.equal(s.calls.some(c=>c.method==="DELETE"&&c.url==="/storage/v1/object/ifund-campaign-documents"),false);
 assert.equal(s.calls.some(c=>c.method==="DELETE"&&c.url==="/rest/v1/ifund_campaign_documents"),true);
});

test("large owner document inventory returns an explicitly incomplete resumable batch",async()=>{
  let remaining=15;
  const calls=[];
  const fetcher=async(url,options)=>{
    const route=new URL(url).pathname;
    calls.push({route,method:options.method});
    if(route.endsWith("/rpc/ifund_super_admin_account_deletion_queue"))
      return Response.json([{request_id:REQUEST,request_status:"reviewing",requested_user_id:OWNER}]);
    if(route.endsWith("/rpc/ifund_super_admin_private_document_inventory"))
      return Response.json(remaining===0?[]:[{
        document_id:DOCUMENT,storage_path:PATH,
        deletion_requested_at:null,storage_present:true,metadata_present:true
      }]);
    if(route==="/rest/v1/ifund_campaign_documents"&&options.method==="PATCH")
      return Response.json([{id:DOCUMENT,allow_agent_use:false,deletion_requested_at:"2026-11-15T17:00:00Z"}]);
    if(route==="/storage/v1/object/ifund-campaign-documents")
      return Response.json([{name:PATH}]);
    if(route.includes("/storage/v1/object/info/"))
      return Response.json({code:"NoSuchKey",message:"missing"},{status:404});
    if(route==="/rest/v1/ifund_campaign_documents"&&options.method==="DELETE"){
      remaining--;
      return Response.json([{id:DOCUMENT}]);
    }
    throw Error("Unexpected request "+route);
  };
  const result=await cleanupPrivateCampaignDocuments({
    fetcher,env:ENV,requestId:REQUEST,jwt:"admin.jwt"
  });
  assert.deepEqual(result,{verified:false,more_documents:true,documents_removed:10,account_deleted:false});
  assert.equal(remaining,5);
});

test("private cleanup reviewer notes are not granted to ordinary member reads",()=>{
 const sql=readFileSync(new URL("../supabase/migrations/20261115194500_ifund_private_document_erasure_review.sql",import.meta.url),"utf8");
 assert.match(sql,/revoke select on public\.ifund_account_deletion_requests from authenticated/);
 assert.match(sql,/grant select\(id,user_id,status,requested_at,updated_at,completed_at\)/);
 assert.match(sql,/document_cleanup_reviewed_by=actor/);
 assert.match(sql,/r\.document_cleanup_reviewed_by is not null/);
 assert.doesNotMatch(sql,/grant select\([^\n]*document_cleanup_review_note/);
});
test("admin erasure never marks the wider account deletion completed",()=>{
 const sql=readFileSync(new URL("../supabase/migrations/20261115194500_ifund_private_document_erasure_review.sql",import.meta.url),"utf8");
 const worker=readFileSync(new URL("../worker/services/privateDocumentErasure.js",import.meta.url),"utf8");
 assert.doesNotMatch(worker,/status\s*[:=]\s*["']completed["']/);
 assert.doesNotMatch(sql,/status\s*=\s*'completed'/);
 assert.match(worker,/account_deleted:false/);
 assert.match(worker,/batchLimit=10/);
});

test("reviewing status alone cannot authorize client-side cleanup action",()=>{
  const ui=readFileSync(new URL("../apps/web/src/pages/AdminDeletionQueue.jsx",import.meta.url),"utf8");
  const sql=readFileSync(new URL("../supabase/migrations/20261115194500_ifund_private_document_erasure_review.sql",import.meta.url),"utf8");
  assert.match(ui,/ifund_super_admin_private_document_reviewed_queue/);
  assert.match(ui,/row.request_status==="reviewing"&&reviewed\[row.request_id\]===true/);
  assert.match(sql,/document_cleanup_reviewed_by is not null/);
  assert.match(sql,/document_cleanup_reviewed_at is not null/);
  assert.match(sql,/status in \('requested','reviewing'\)/);
  assert.match(sql,/reviewed_by is null/);
  assert.match(sql,/Verified super administrator required/);
  assert.match(ui,/Private-file cleanup is a separate irreversible action/);
});

test("admin queue does not expose prior administrator requests after session change",()=>{
  const source=readFileSync(new URL("../apps/web/src/pages/AdminDeletionQueue.jsx",import.meta.url),"utf8");
  assert.match(source,/onAuthStateChange/);
  assert.match(source,/setRows\(\[\]\);setReviewed\(\{\}\)/);
  assert.match(source,/!scope\.active\|\|afterError\|\|after\?\.user\?\.id!==scope\.ownerId/);
  assert.match(source,/scope\.observe\(session\?\.user\?\.id\)/);
  assert.match(source,/runAdminReview\(scope,client/);
  assert.match(source,/subscription\?\.subscription\?\.unsubscribe/);
});

test("active Supabase session is required for every destructive admin RPC",()=>{
 const sql=readFileSync(new URL("../supabase/migrations/20261115194500_ifund_private_document_erasure_review.sql",import.meta.url),"utf8");
 assert.match(sql,/from auth\.sessions s/);
 assert.match(sql,/s\.user_id=auth\.uid\(\)/);
 assert.match(sql,/s\.not_after is null or s\.not_after>now\(\)/);
 assert.match(sql,/auth\.jwt\(\)->>'session_id'/);
 assert.equal((sql.match(/or not coalesce\(public\.ifund_private_document_admin_session_valid\(\),false\)/g)||[]).length,3);
 assert.match(sql,/revoke all on function public\.ifund_private_document_admin_session_valid\(\) from public,anon,authenticated/);
});

test("missing Storage bucket is not proof the file bytes were erased",async()=>{
 const s=service({missingCode:"NoSuchBucket"});
 await assert.rejects(cleanupPrivateCampaignDocuments({
   fetcher:s.fetcher,env:ENV,requestId:REQUEST,jwt:"admin.jwt"
 }),/missing-file proof/);
 assert.equal(s.calls.some(c=>c.method==="DELETE"&&c.url==="/rest/v1/ifund_campaign_documents"),false);
});
