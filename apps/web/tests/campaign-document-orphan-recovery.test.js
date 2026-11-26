import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {findStaleCampaignDocumentUploads,removeStaleCampaignDocumentUpload} from "../src/api/campaignDocuments.js";
const OWNER="11111111-1111-4111-8111-111111111111",CAMPAIGN="22222222-2222-4222-8222-222222222222",ID="33333333-3333-4333-8333-333333333333";
const FILE=ID+".pdf",PATH="private/campaign-documents/"+OWNER+"/"+CAMPAIGN+"/"+FILE;
function clientFor(owner=OWNER){
 const user={id:owner,email_confirmed_at:"2026-11-26",is_anonymous:false};
 return {auth:{
  getUser:async()=>({data:{user},error:null}),
  getSession:async()=>({data:{session:{user,access_token:"member-token-1234567890123456789"}},error:null})
 },storage:{from:()=>assert.fail("private documents cannot read Supabase Storage")},
 from(table){const q={
  select(){return q;},eq(){return q;},order(){return q;},limit(){return q;},
  maybeSingle:async()=>({data:table==="ifund_profiles"?{account_status:"active",account_deletion_pending:false}:{id:CAMPAIGN,owner_id:owner},error:null}),
  then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject);}
 };return q;}
 };
}
test("private document recovery lists only owned R2 paths with server-checked age and no registered metadata",async()=>{
 const client=clientFor();let calls=0;
 const files=await findStaleCampaignDocumentUploads(client,CAMPAIGN,{fetcher:async(path,opts)=>{
  calls++;assert.equal(path,"/api/media/documents/"+CAMPAIGN+"/orphans");assert.equal(opts.method,"GET");
  return Response.json({items:[{path:PATH,name:FILE,createdAt:"2026-11-20T08:00:00.000Z"}]});
 }});
 assert.equal(calls,1);assert.equal(files[0].path,PATH);
});
test("untrusted orphan lists from another owner or malformed object keys are rejected",async()=>{
 for(const path of ["private/campaign-documents/99999999-9999-4999-8999-999999999999/"+CAMPAIGN+"/"+FILE,
  "private/campaign-documents/"+OWNER+"/"+CAMPAIGN+"/../../secret.pdf"]){
  await assert.rejects(findStaleCampaignDocumentUploads(clientFor(),CAMPAIGN,{fetcher:async()=>Response.json({
   items:[{path,name:FILE,createdAt:"2026-11-20T08:00:00Z"}]
  })}),/could not be verified/);
 }
});
test("owner cleanup deletes through R2 server endpoint and requires verified 204 absence",async()=>{
 let requests=0;
 const ok=await removeStaleCampaignDocumentUpload(clientFor(),CAMPAIGN,PATH,{
  fetcher:async(path,opts)=>{
   requests++;assert.equal(path,"/api/media/documents/"+CAMPAIGN+"/orphans/"+FILE);
   assert.equal(opts.method,"DELETE");
   assert.equal(opts.headers.origin,"https://interplanetaryfund.com");
   return new Response(null,{status:204});
  }
 });
 assert.equal(ok,true);assert.equal(requests,1);
});
test("registered or unverified storage delete failure remains pending instead of claiming removal",async()=>{
 await assert.rejects(removeStaleCampaignDocumentUpload(clientFor(),CAMPAIGN,PATH,{
  fetcher:async()=>Response.json({error:"Document is registered"},{status:409})
 }),/registered/);
 await assert.rejects(removeStaleCampaignDocumentUpload(clientFor(),CAMPAIGN,PATH,{
  fetcher:async()=>Response.json({error:"Object may still exist"},{status:503})
 }),/Object may still exist/);
});
test("malformed or foreign cleanup paths are rejected before sending network requests",async()=>{
 let calls=0;
 for(const path of ["private/campaign-documents/"+OWNER+"/"+CAMPAIGN+"/../secret.pdf",
  "private/campaign-documents/"+OWNER+"/"+CAMPAIGN+"/foreign.exe",
  "private/campaign-documents/other/"+CAMPAIGN+"/"+FILE]){
  await assert.rejects(removeStaleCampaignDocumentUpload(clientFor(),CAMPAIGN,path,{
   fetcher:async()=>{calls++;return new Response(null,{status:204});}
  }),/Only an owned/);
 }
 assert.equal(calls,0);
});
test("server-side cleanup uses R2 custom metadata, age, owner and an independent database-absence check",()=>{
 const source=readFileSync(new URL("../../../worker/media/privateDocuments.js",import.meta.url),"utf8");
 for(const pattern of [/include:\["customMetadata"\]/,/ORPHAN_AGE/,/object\.customMetadata\?\.owner_id/,/records\.length/,/bucket\.head\(objectKey\)/])
   assert.match(source,pattern);
 const ui=readFileSync(new URL("../src/components/campaigns/CampaignDocuments.jsx",import.meta.url),"utf8");
 assert.match(ui,/Recover storage from interrupted uploads/);
 assert.match(ui,/accountGeneration/);
 assert.match(ui,/onAuthStateChange/);
});
