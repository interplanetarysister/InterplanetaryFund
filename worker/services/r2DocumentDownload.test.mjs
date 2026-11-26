import test from "node:test";
import assert from "node:assert/strict";
import {routePrivateDocumentDownload} from "./r2DocumentDownload.mjs";
const owner="11111111-1111-4111-8111-111111111111";
const campaign="22222222-2222-4222-8222-222222222222";
const id="33333333-3333-4333-8333-333333333333";
const sha="ab".repeat(32);
const key="private/campaign-documents/"+owner+"/"+campaign+"/"+id+".pdf";
const receipt={id,owner_id:owner,campaign_id:campaign,object_store:"r2",storage_path:key,object_etag:'"receipt"',object_sha256:sha,object_verified_at:"2026-11-25T00:00:00Z",file_size:5,media_type:"application/pdf",deletion_requested_at:null};
const head={size:5,httpEtag:'"receipt"',checksums:{sha256:sha}};
const url="https://interplanetaryfund.com/api/campaign-documents/download?campaign_id="+campaign+"&document_id="+id;
function fixture({row=receipt,owned=true,authorized=true,flag="enabled",changed=false,anonymous=false,revokedDuringRead=false}={}){
 const calls=[];let documentReads=0;
 const env={IFUND_PRIVATE_R2_DOCUMENT_READ_ENABLED:flag,SUPABASE_PUBLISHABLE_KEY:"synthetic",
  IFUND_CAMPAIGN_MEDIA:{head:async path=>{calls.push(["head",path]);return head;},
   get:async path=>{calls.push(["get",path]);return {...head,size:changed?6:5,body:"%PDF-"};}}};
 const authenticate=async()=>{calls.push(["auth"]);if(anonymous)throw Object.assign(Error("Sign in"),{status:401});
  return {user:{id:owner},jwt:"synthetic",rpc:async name=>{calls.push(["rpc",name]);return authorized;}};};
 const fetcher=async path=>{calls.push(["rest",path]);return Response.json(path.includes("ifund_campaign_documents")?[++documentReads>1&&revokedDuringRead?{...row,deletion_requested_at:"2026-11-26T00:00:00Z"}:row]:owned?[{id:campaign,owner_id:owner}]:[]);};
 return {env,calls,options:{authenticate,fetcher}};
}
const run=(f,req=new Request(url))=>routePrivateDocumentDownload(req,f.env,f.options);
test("owner receives verified bytes as a private attachment",async()=>{
 const f=fixture(),r=await run(f);
 assert.equal(r.status,200);assert.equal(await r.text(),"%PDF-");
 assert.equal(r.headers.get("cache-control"),"private, no-store");
 assert.equal(r.headers.get("content-disposition"),"attachment");
 assert.equal(r.headers.get("content-length"),"5");
 assert.deepEqual(f.calls.filter(x=>x[0]==="get"),[["get",key]]);
});
test("disabled flag, invalid methods and malformed identifiers do not reach authentication",async()=>{
 for(const [f,req,status] of [[fixture({flag:"disabled"}),new Request(url),503],[fixture(),new Request(url,{method:"POST"}),405],[fixture(),new Request(url+"&storage_path=foreign"),400]]){
  assert.equal((await run(f,req)).status,status);assert.deepEqual(f.calls,[]);
 }
});
test("anonymous, inactive and cross-owner records never reach R2",async()=>{
 for(const [f,status] of [[fixture({anonymous:true}),401],[fixture({authorized:false}),403],[fixture({owned:false}),404],[fixture({row:{...receipt,owner_id:campaign}}),404],[fixture({row:{...receipt,deletion_requested_at:"2026-11-25T00:00:00Z"}}),404],[fixture({row:{...receipt,storage_path:key.replace(".pdf",".txt")}}),404]]){
  assert.equal((await run(f)).status,status);assert.ok(!f.calls.some(x=>x[0]==="head"||x[0]==="get"));
 }
});
test("changed object receipt fails closed",async()=>{
 const f=fixture({changed:true}),r=await run(f);assert.equal(r.status,503);
 assert.match((await r.json()).error,/independently verified/);
});

test("document revoked while object is resolving is denied before streaming",async()=>{
 const f=fixture({revokedDuringRead:true}),r=await run(f);
 assert.equal(r.status,404);
 assert.equal(f.calls.filter(x=>x[0]==="get").length,1);
 assert.equal(f.calls.filter(x=>x[0]==="rest"&&x[1].includes("ifund_campaign_documents")).length,2);
});
