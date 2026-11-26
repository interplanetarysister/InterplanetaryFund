import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {routeMemberMedia} from "../../../worker/media/memberMedia.js";

const BASE="https://interplanetaryfund.com",SUPABASE="https://ssibsfmtodgximseeqsv.supabase.co";
const OWNER="11111111-1111-4111-8111-111111111111",OTHER="22222222-2222-4222-8222-222222222222";
const TOKEN_A="a".repeat(48),TOKEN_B="b".repeat(48),PNG=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4]);
const digest=data=>createHash("sha256").update(data).digest("hex");
function fixture({denied=false,stuckDelete=false}={}){
 const rows=new Map(),objects=new Map(),calls=[];
 const bucket={
  put:async(key,bytes,metadata)=>{calls.push("put");objects.set(key,{bytes:Uint8Array.from(bytes),...metadata,etag:"etag-1",uploaded:new Date("2026-11-20")});},
  head:async key=>{calls.push("head");const v=objects.get(key);return v?{size:v.bytes.length,etag:v.etag,uploaded:v.uploaded,httpMetadata:v.httpMetadata,customMetadata:v.customMetadata}:null;},
  get:async key=>{calls.push("get");const v=objects.get(key);return v?{size:v.bytes.length,etag:v.etag,body:Uint8Array.from(v.bytes),httpMetadata:v.httpMetadata,customMetadata:v.customMetadata,arrayBuffer:async()=>Uint8Array.from(v.bytes).buffer}:null;},
  delete:async key=>{calls.push("delete");if(!stuckDelete)objects.delete(key);},
  list:async({prefix})=>({objects:[...objects].filter(([key])=>key.startsWith(prefix)).map(([key,value])=>({key,customMetadata:value.customMetadata,uploaded:value.uploaded})),truncated:false})
 };
 const actor=init=>(init.headers?.authorization==="Bearer "+TOKEN_B?OTHER:OWNER);
 async function fake(url,init){
  const link=new URL(url);const path=link.pathname;calls.push(init.method+" "+path);
  const owner=actor(init),body=init.body?JSON.parse(init.body):{};
  if(path==="/auth/v1/user")return Response.json({id:owner,is_anonymous:false,email_confirmed_at:"2026-11-26"});
  if(path==="/rest/v1/ifund_profiles")return Response.json([{account_status:"active",account_deletion_pending:false}]);
  if(path.startsWith("/rest/v1/rpc/")){
   if(["ifund_member_connection_allowed","ifund_current_user_has_current_terms","ifund_device_rate_limit"].includes(path.split("/").at(-1)))return Response.json(!denied);
   throw Error("Unexpected RPC "+path);
  }
  if(path==="/rest/v1/ifund_member_media"){
   if(init.method==="GET"){
    let found=[...rows.values()];
    if(link.searchParams.has("owner_id"))found=found.filter(v=>v.owner_id===link.searchParams.get("owner_id").replace("eq.",""));
    if(link.searchParams.has("id"))found=found.filter(v=>v.id===link.searchParams.get("id").replace("eq.",""));
    if(link.searchParams.has("object_path"))found=found.filter(v=>v.object_path===link.searchParams.get("object_path").replace("eq.",""));
    return Response.json(found);
   }
   if(init.method==="POST"){rows.set(body.id,{...body});return Response.json([{...body}]);}
   const id=link.searchParams.get("id").replace("eq.",""),row=rows.get(id);
   if(!row)return Response.json([]);
   if(init.method==="PATCH"){Object.assign(row,body);return Response.json([{id:row.id,deletion_requested_at:row.deletion_requested_at}]);}
   if(init.method==="DELETE"){rows.delete(id);return Response.json([{id}]);}
  }
  throw Error("Unexpected request "+init.method+" "+path);
 }
 const env={IFUND_CAMPAIGN_MEDIA_ENABLED:"enabled",IFUND_CAMPAIGN_MEDIA:bucket,
  SUPABASE_URL:SUPABASE,SUPABASE_SECRET_KEY:"sb_secret_fixture_only",
  SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture_only"};
 const request=(path,method="GET",{token=TOKEN_A,body=null,origin=BASE,headers={}}={})=>
  new Request(BASE+path,{method,headers:{authorization:"Bearer "+token,
   ...(["POST","DELETE"].includes(method)?{origin}:{}),...headers},
   ...(body?{body}:{} )});
 return {env,fetcher:fake,request,rows,objects,calls};
}
test("owner can upload, retrieve, list and permanently delete image bytes with verified R2 receipts",async()=>{
 const f=fixture();
 const request=f.request("/api/media/library","POST",{body:PNG,headers:{"content-type":"image/png","x-ifund-file-name":"test.png"}});
 const upload=await routeMemberMedia(request,f.env,f.fetcher);
 assert.equal(upload.status,201);
 const result=await upload.json();
 assert.match(result.id,/^[0-9a-f-]{36}$/);
 assert.equal(result.sha256,digest(PNG));
 assert.equal(f.objects.size,1);
 assert.equal(f.rows.size,1);
 const list=await routeMemberMedia(f.request("/api/media/library"),f.env,f.fetcher);
 assert.equal(list.status,200);assert.equal((await list.json()).items.length,1);
 const download=await routeMemberMedia(f.request("/api/media/library/file/"+result.id),f.env,f.fetcher);
 assert.equal(download.status,200);
 assert.deepEqual(new Uint8Array(await download.arrayBuffer()),PNG);
 assert.equal(download.headers.get("x-ifund-media-sha256"),digest(PNG));
 const deleted=await routeMemberMedia(f.request("/api/media/library/file/"+result.id,"DELETE"),f.env,f.fetcher);
 assert.equal(deleted.status,204);assert.equal(f.objects.size,0);assert.equal(f.rows.size,0);
});
test("foreign account and unsigned clients cannot access or delete someone else's media",async()=>{
 const f=fixture();
 const uploaded=await routeMemberMedia(f.request("/api/media/library","POST",{
  body:PNG,headers:{"content-type":"image/png","x-ifund-file-name":"test.png"}
 }),f.env,f.fetcher);
 const {id}=await uploaded.json();
 const get=await routeMemberMedia(f.request("/api/media/library/file/"+id,"GET",{token:TOKEN_B}),f.env,f.fetcher);
 assert.equal(get.status,404);
 const del=await routeMemberMedia(f.request("/api/media/library/file/"+id,"DELETE",{token:TOKEN_B}),f.env,f.fetcher);
 assert.equal(del.status,404);
 assert.equal(f.objects.size,1);
 const crossSite=await routeMemberMedia(f.request("/api/media/library/file/"+id,"DELETE",{origin:"https://evil.example"}),f.env,f.fetcher);
 assert.equal(crossSite.status,403);
 assert.equal(f.objects.size,1);
});
test("declared image type must match bytes and rate limits deny before an R2 write",async()=>{
 const f=fixture();
 const wrong=await routeMemberMedia(f.request("/api/media/library","POST",{
  body:PNG,headers:{"content-type":"audio/wav","x-ifund-file-name":"voice.wav"}
 }),f.env,f.fetcher);
 assert.equal(wrong.status,415);assert.equal(f.objects.size,0);
 const limited=fixture({denied:true});
 const result=await routeMemberMedia(limited.request("/api/media/library","POST",{
  body:PNG,headers:{"content-type":"image/png","x-ifund-file-name":"test.png"}
 }),limited.env,limited.fetcher);
 assert.ok([403,429].includes(result.status));assert.equal(limited.objects.size,0);
});
test("failed R2 deletion keeps the tombstone and metadata for retry",async()=>{
 const f=fixture({stuckDelete:true});
 const upload=await routeMemberMedia(f.request("/api/media/library","POST",{
  body:PNG,headers:{"content-type":"image/png","x-ifund-file-name":"test.png"}
 }),f.env,f.fetcher);
 const {id}=await upload.json();
 const result=await routeMemberMedia(f.request("/api/media/library/file/"+id,"DELETE"),f.env,f.fetcher);
 assert.equal(result.status,503);
 assert.ok(f.rows.get(id)?.deletion_requested_at);
 assert.equal(f.objects.size,1);
 const hidden=await routeMemberMedia(f.request("/api/media/library/file/"+id),f.env,f.fetcher);
 assert.equal(hidden.status,404);
});
