import test from "node:test";
import assert from "node:assert/strict";
import {onRequest as upload} from "../functions/api/media/campaign/upload.js";
import {onRequest as serve} from "../functions/api/media/campaign/file/[file].js";
import {deleteCampaignCover} from "../src/api/campaignMedia.js";
import {uploadCampaignCover} from "../src/api/campaignMedia.js";
const owner="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222";
const origin="https://preview.interplanetaryfund-migration.pages.dev",token="a".repeat(50),png=new Uint8Array([137,80,78,71,13,10,26,10]);
function request(body=png,options={}){return new Request(origin+"/api/media/campaign/upload",{method:"POST",headers:{origin,authorization:"Bearer "+token,"content-type":"image/png",...options.headers},body,...options});}
function fixture({anonymous=false,deleted=false,corrupt=false,limited=false,referenced=false}={}){
 const objects=new Map(),ledger=new Map();let calls=0;
 const env={IFUND_CAMPAIGN_MEDIA_ENABLED:"enabled",SUPABASE_SECRET_KEY:"s".repeat(30),SUPABASE_URL:"https://ssibsfmtodgximseeqsv.supabase.co",SUPABASE_PUBLISHABLE_KEY:"public-test-key",IFUND_CAMPAIGN_MEDIA:{
  async put(key,bytes,metadata){objects.set(key,{bytes:new Uint8Array(bytes),...metadata});},
  async head(key){const o=objects.get(key);return o?{size:o.bytes.length,httpMetadata:o.httpMetadata,customMetadata:o.customMetadata}:null;},
  async delete(key){objects.delete(key);},
  async get(key){const o=objects.get(key);if(!o)return null;return {size:o.bytes.length,httpMetadata:o.httpMetadata,body:o.bytes,arrayBuffer:async()=>corrupt?new Uint8Array(o.bytes.length).buffer:o.bytes.buffer};}
 }};
 const fetcher=async (url,init)=>{
  calls++;
  if(String(url).endsWith("/rpc/ifund_device_rate_limit")){
   const p=JSON.parse(init.body);assert.match(p.p_bucket_hash,/^[a-f0-9]{64}$/);assert.ok(p.p_limit>=1&&p.p_limit<=1000);assert.ok(p.p_window_seconds>=1&&p.p_window_seconds<=86400);return Response.json(!limited);
  }
  if(String(url).includes("/rest/v1/ifund_public_cover_objects")){
   const parsed=new URL(String(url)),key=(parsed.searchParams.get("object_key")||"").replace(/^eq\./,"");
   if(init.method==="POST"){
    const row={...JSON.parse(init.body),deleted_at:null};
    ledger.set(row.object_key,row);
    return Response.json([{object_key:row.object_key,owner_id:row.owner_id,object_sha256:row.object_sha256}]);
   }
   if(init.method==="PATCH"){
    const row=ledger.get(key);
    if(!row)return Response.json([]);
    row.deleted_at=JSON.parse(init.body).deleted_at;
    return Response.json([{object_key:row.object_key,deleted_at:row.deleted_at}]);
   }
   return Response.json(ledger.has(key)?[ledger.get(key)]:[]);
  }
  if(String(url).includes("/rest/v1/ifund_campaigns?"))return Response.json(referenced?[{id:other}]:[]);
  if(String(url).endsWith("/auth/v1/user"))return Response.json({id:owner,email_confirmed_at:"yes",is_anonymous:anonymous});
  if(String(url).includes("ifund_profiles"))return Response.json([{account_status:"active",account_deletion_pending:deleted}]);
  throw Error("Unexpected upstream request");
 };
 return {env,fetcher,objects,ledger,getCalls:()=>calls};
}
async function withFetch(fetcher,run){const original=globalThis.fetch;globalThis.fetch=fetcher;try{return await run();}finally{globalThis.fetch=original;}}
test("public image bytes round-trip through canonical R2 with verified digest and GET/HEAD delivery",async()=>{
 const h=fixture();
 await withFetch(h.fetcher,async()=>{
  const response=await upload({request:request(),env:h.env});assert.equal(response.status,201);
  const result=await response.json();assert.equal(result.bytes,png.length);assert.match(result.sha256,/^[a-f0-9]{64}$/);
  assert.ok(!result.url.includes(owner));assert.equal(h.objects.size,1);assert.ok([...h.objects.keys()][0].startsWith("campaigns/public/"));
  const file=new URL(result.url).pathname.split("/").at(-1);
  const get=await serve({request:new Request(result.url),env:h.env,params:{owner,file}});
  assert.equal(get.status,200);assert.equal(get.headers.get("content-type"),"image/png");assert.deepEqual(new Uint8Array(await get.arrayBuffer()),png);
  const head=await serve({request:new Request(result.url,{method:"HEAD"}),env:h.env,params:{owner,file}});
  assert.equal(head.status,200);assert.equal(await head.text(),"");
 });
});
test("image handler rejects inactive/anonymous owners, wrong origin and disabled bindings before R2 writes",async()=>{
 for(const options of [{anonymous:true},{deleted:true}]){
  const h=fixture(options);await withFetch(h.fetcher,async()=>assert.equal((await upload({request:request(),env:h.env})).status,401));assert.equal(h.objects.size,0);
 }
 const h=fixture();
 assert.equal((await upload({request:request(),env:{...h.env,IFUND_CAMPAIGN_MEDIA_ENABLED:"disabled"}})).status,503);
 assert.equal((await upload({request:new Request(origin+"/api/media/campaign/upload",{method:"POST",headers:{origin:"https://evil.example"},body:png}),env:h.env})).status,403);
 assert.equal(h.getCalls(),0);assert.equal(h.objects.size,0);
});
test("mismatched signatures, oversized bodies and corrupted R2 readback never report upload success",async()=>{
 const h=fixture();await withFetch(h.fetcher,async()=>{
  assert.equal((await upload({request:request(new Uint8Array([1,2,3])),env:h.env})).status,415);
  assert.equal((await upload({request:request(png,{headers:{"content-type":"image/png",origin,authorization:"Bearer "+token,"content-length":String(6*1024*1024)}}),env:h.env})).status,413);
 });assert.equal(h.objects.size,0);
 const broken=fixture({corrupt:true});await withFetch(broken.fetcher,async()=>assert.equal((await upload({request:request(),env:broken.env})).status,503));
});
test("public serving cannot traverse private paths or serve executable/non-image content",async()=>{
 const h=fixture();for(const file of ["../private.pdf","document.docx","../../secret","1.svg"])
  assert.equal((await serve({request:new Request(origin),env:h.env,params:{owner,file}})).status,404);
});
function browserClient(){let current=owner,listener=()=>{};return {setOwner:id=>{current=id;listener("SIGNED_IN",{user:{id,email_confirmed_at:"yes",is_anonymous:false}});},auth:{onAuthStateChange:fn=>{listener=fn;return {data:{subscription:{unsubscribe(){listener=()=>{};}}}};},getUser:async()=>({data:{user:{id:current,email_confirmed_at:"yes",is_anonymous:false}}}),getSession:async()=>({data:{session:{user:{id:current},access_token:token}}})},from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{account_status:"active",account_deletion_pending:false}})})};}
test("browser uploader requires its own verified R2 receipt and rejects changed accounts or forged URLs",async()=>{
 const file=new File([png],"cover.png",{type:"image/png"}),client=browserClient();
 const valid={url:origin+"/api/media/campaign/file/"+other+".png",content_type:"image/png",bytes:file.size,sha256:Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",png)),b=>b.toString(16).padStart(2,"0")).join("")};
 assert.equal(await uploadCampaignCover(client,file,{origin,fetcher:async()=>Response.json(valid,{status:201})}),valid.url);
 await assert.rejects(uploadCampaignCover(client,file,{origin,fetcher:async()=>Response.json({...valid,url:"https://evil.example/image.png"},{status:201})}),/verified image link/);
 await assert.rejects(uploadCampaignCover(client,file,{origin,fetcher:async()=>{client.setOwner(other);return Response.json(valid,{status:201});}}),/account changed/);
});

test("upload quotas fail closed before any object write",async()=>{
 const h=fixture({limited:true});await withFetch(h.fetcher,async()=>assert.equal((await upload({request:request(),env:h.env})).status,429));assert.equal(h.objects.size,0);
});

test("an account switch during file hashing permanently cancels the upload before mutation",async()=>{
 const client=browserClient(),file=new File([png],"cover.png",{type:"image/png"});
 file.arrayBuffer=async()=>{client.setOwner(other);client.setOwner(owner);return png.buffer;};
 await assert.rejects(uploadCampaignCover(client,file,{origin,fetcher:()=>assert.fail("stale owner must not upload")}),/account changed/);
});

test("owner can permanently delete a stored R2 cover only when it has no saved campaign references",async()=>{
 const h=fixture();
 await withFetch(h.fetcher,async()=>{
  const sent=await upload({request:request(),env:h.env});
  const receipt=await sent.json(),file=new URL(receipt.url).pathname.split("/").at(-1);
  const res=await serve({request:new Request(receipt.url,{method:"DELETE",headers:{
   origin,authorization:"Bearer "+token
  }}),env:h.env,params:{file}});
  assert.equal(res.status,204);
  assert.equal(h.objects.size,0);
  assert.equal((await serve({request:new Request(receipt.url),env:h.env,params:{file}})).status,404);
 });
});
test("campaign-referenced cover remains stored and cannot be removed",async()=>{
 const h=fixture({referenced:true});
 await withFetch(h.fetcher,async()=>{
  const receipt=await(await upload({request:request(),env:h.env})).json();
  const file=new URL(receipt.url).pathname.split("/").at(-1);
  const response=await serve({request:new Request(receipt.url,{method:"DELETE",headers:{
   origin,authorization:"Bearer "+token
  }}),env:h.env,params:{file}});
  assert.equal(response.status,409);
  assert.equal(h.objects.size,1);
 });
});
test("unauthorized deletion cannot erase another member's cover or bypass origin checks",async()=>{
 const h=fixture();
 await withFetch(h.fetcher,async()=>{
  const receipt=await(await upload({request:request(),env:h.env})).json(),file=new URL(receipt.url).pathname.split("/").at(-1);
  const key=[...h.objects.keys()][0];
  h.objects.get(key).customMetadata.owner_id=other;
  const denied=await serve({request:new Request(receipt.url,{method:"DELETE",headers:{
   origin,authorization:"Bearer "+token
  }}),env:h.env,params:{file}});
  assert.equal(denied.status,403);
  const crossSite=await serve({request:new Request(receipt.url,{method:"DELETE",headers:{
   origin:"https://malicious.example",authorization:"Bearer "+token
  }}),env:h.env,params:{file}});
  assert.equal(crossSite.status,403);
  assert.equal(h.objects.size,1);
 });
});
test("browser cover removal refuses forged URLs before calling any DELETE operation",async()=>{
 const client=browserClient();let calls=0;
 for(const url of ["https://evil.example/cover.png",origin+"/api/media/campaign/file/bad.png",origin+"/api/media/campaign/file/"+other+".png?x=1"]){
  await assert.rejects(deleteCampaignCover(client,url,{origin,fetcher:async()=>{calls++;return new Response(null,{status:204})}}),/verified iFund/);
 }
 assert.equal(calls,0);
});
