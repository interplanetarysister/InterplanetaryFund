import test from "node:test";
import assert from "node:assert/strict";
import {onRequest as upload} from "../functions/api/media/campaign/upload.js";
import {onRequest as serve} from "../functions/api/media/campaign/[owner]/[file].js";
import {uploadCampaignCover} from "../src/api/campaignMedia.js";
const owner="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222";
const origin="https://preview.interplanetaryfund-migration.pages.dev",token="a".repeat(50),png=new Uint8Array([137,80,78,71,13,10,26,10]);
function request(body=png,options={}){return new Request(origin+"/api/media/campaign/upload",{method:"POST",headers:{origin,authorization:"Bearer "+token,"content-type":"image/png",...options.headers},body,...options});}
function fixture({anonymous=false,deleted=false,corrupt=false}={}){
 const objects=new Map();let calls=0;
 const env={IFUND_CAMPAIGN_MEDIA_ENABLED:"enabled",SUPABASE_URL:"https://ssibsfmtodgximseeqsv.supabase.co",SUPABASE_PUBLISHABLE_KEY:"public-test-key",IFUND_CAMPAIGN_MEDIA:{
  async put(key,bytes,metadata){objects.set(key,{bytes:new Uint8Array(bytes),...metadata});},
  async head(key){const o=objects.get(key);return o?{size:o.bytes.length}:null;},
  async get(key){const o=objects.get(key);if(!o)return null;return {size:o.bytes.length,httpMetadata:o.httpMetadata,body:o.bytes,arrayBuffer:async()=>corrupt?new Uint8Array(o.bytes.length).buffer:o.bytes.buffer};}
 }};
 const fetcher=async url=>{
  calls++;
  if(String(url).endsWith("/auth/v1/user"))return Response.json({id:owner,email_confirmed_at:"yes",is_anonymous:anonymous});
  if(String(url).includes("ifund_profiles"))return Response.json([{account_status:"active",account_deletion_pending:deleted}]);
  throw Error("Unexpected upstream request");
 };
 return {env,fetcher,objects,getCalls:()=>calls};
}
async function withFetch(fetcher,run){const original=globalThis.fetch;globalThis.fetch=fetcher;try{return await run();}finally{globalThis.fetch=original;}}
test("public image bytes round-trip through canonical R2 with verified digest and GET/HEAD delivery",async()=>{
 const h=fixture();
 await withFetch(h.fetcher,async()=>{
  const response=await upload({request:request(),env:h.env});assert.equal(response.status,201);
  const result=await response.json();assert.equal(result.bytes,png.length);assert.match(result.sha256,/^[a-f0-9]{64}$/);
  assert.equal(h.objects.size,1);assert.ok([...h.objects.keys()][0].startsWith("campaigns/"+owner+"/"));
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
function browserClient(){let current=owner;return {setOwner:id=>{current=id;},auth:{getUser:async()=>({data:{user:{id:current,email_confirmed_at:"yes",is_anonymous:false}}}),getSession:async()=>({data:{session:{user:{id:current},access_token:token}}})},from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{account_status:"active",account_deletion_pending:false}})})};}
test("browser uploader requires its own verified R2 receipt and rejects changed accounts or forged URLs",async()=>{
 const file=new File([png],"cover.png",{type:"image/png"}),client=browserClient();
 const valid={url:origin+"/api/media/campaign/"+owner+"/"+other+".png",content_type:"image/png",bytes:file.size,sha256:"a".repeat(64)};
 assert.equal(await uploadCampaignCover(client,file,{origin,fetcher:async()=>Response.json(valid,{status:201})}),valid.url);
 await assert.rejects(uploadCampaignCover(client,file,{origin,fetcher:async()=>Response.json({...valid,url:"https://evil.example/image.png"},{status:201})}),/verified image link/);
 await assert.rejects(uploadCampaignCover(client,file,{origin,fetcher:async()=>{client.setOwner(other);return Response.json(valid,{status:201});}}),/account changed/);
});
