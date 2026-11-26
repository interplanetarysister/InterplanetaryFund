import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {routePrivateDocuments} from "../../../worker/media/privateDocuments.js";
const BASE="https://interplanetaryfund.com",DB="https://ssibsfmtodgximseeqsv.supabase.co";
const OWNER="11111111-1111-4111-8111-111111111111",OTHER="22222222-2222-4222-8222-222222222222";
const CAMPAIGN="33333333-3333-4333-8333-333333333333",TOKEN_A="a".repeat(48),TOKEN_B="b".repeat(48);
const PDF=new TextEncoder().encode("%PDF-1.7\nOwner budget PDF test");
function fixture({stuckDelete=false,failReceipt=false,saveThenLoseReceipt=false}={}){
 const objects=new Map(),rows=new Map(),trace=[];
 const bucket={
  put:async(key,bytes,meta)=>{objects.set(key,{bytes:Uint8Array.from(bytes),...meta,etag:"r2-etag",uploaded:new Date("2026-11-20")});trace.push("put");},
  get:async key=>{const o=objects.get(key);return o?{size:o.bytes.length,etag:o.etag,
   httpMetadata:o.httpMetadata,customMetadata:o.customMetadata,body:Uint8Array.from(o.bytes),
   arrayBuffer:async()=>Uint8Array.from(o.bytes).buffer}:null;},
  head:async key=>{const o=objects.get(key);return o?{size:o.bytes.length,etag:o.etag,
   httpMetadata:o.httpMetadata,customMetadata:o.customMetadata,uploaded:o.uploaded}:null;},
  delete:async key=>{trace.push("delete-r2");if(!stuckDelete)objects.delete(key);},
  list:async({prefix})=>({objects:[...objects].filter(([key])=>key.startsWith(prefix)).map(([key,o])=>({
   key,customMetadata:o.customMetadata,uploaded:o.uploaded})),truncated:false})
 };
 async function fake(url,opts){
  const link=new URL(url),name=link.pathname;
  trace.push(opts.method+" "+name);
  const jwtOwner=opts.headers?.authorization==="Bearer "+TOKEN_B?OTHER:OWNER;
  const body=opts.body?JSON.parse(opts.body):{};
  if(name==="/auth/v1/user")return Response.json({id:jwtOwner,email_confirmed_at:"2026-11-26",is_anonymous:false});
  if(name==="/rest/v1/ifund_profiles")return Response.json([{account_status:"active",account_deletion_pending:false}]);
  if(name==="/rest/v1/ifund_campaigns")return Response.json(jwtOwner===OWNER?[{id:CAMPAIGN,owner_id:OWNER}]:[]);
  if(name==="/rest/v1/rpc/ifund_campaign_document_upload_permitted"||
     name==="/rest/v1/rpc/ifund_device_rate_limit")return Response.json(true);
  if(name==="/rest/v1/ifund_campaign_documents"){
   if(opts.method==="GET"){
    let found=[...rows.values()];
    for(const key of ["owner_id","campaign_id","id","storage_path"])
     if(link.searchParams.has(key)){
      const value=link.searchParams.get(key).replace("eq.","");
      found=found.filter(x=>x[key]===value);
     }
    return Response.json(found);
   }
   if(opts.method==="POST"){
    if(failReceipt&&!saveThenLoseReceipt)return Response.json({error:"registration denied"},{status:400});
    rows.set(body.id,{...body});
    if(saveThenLoseReceipt)return Response.json({error:"upstream response lost"},{status:503});
    return Response.json([body]);
   }
   const id=link.searchParams.get("id").replace("eq.",""),row=rows.get(id);
   if(!row)return Response.json([]);
   if(opts.method==="PATCH"){Object.assign(row,body);return Response.json([{id:row.id,deletion_requested_at:row.deletion_requested_at}]);}
   if(opts.method==="DELETE"){rows.delete(id);trace.push("delete-db");return Response.json([{id}]);}
  }
  throw Error("unexpected upstream request: "+opts.method+" "+name);
 }
 const env={SUPABASE_URL:DB,SUPABASE_SECRET_KEY:"sb_secret_fixture_only",
  SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture",IFUND_CAMPAIGN_MEDIA_ENABLED:"enabled",
  IFUND_CAMPAIGN_MEDIA:bucket};
 const request=(path,method="GET",{
  token=TOKEN_A,body=null,headers={},origin=BASE
 }={})=>new Request(BASE+path,{method,headers:{
  authorization:"Bearer "+token,...(["POST","DELETE"].includes(method)?{origin}:{}),...headers
 },...(body?{body}:{})});
 return {env,request,fetcher:fake,rows,objects,trace};
}
test("owner uploads an 8 MB-limited PDF to private R2, downloads it intact, then erases it",async()=>{
 const s=fixture(),base="/api/media/documents/"+CAMPAIGN;
 const posted=await routePrivateDocuments(s.request(base,"POST",{
  body:PDF,headers:{"content-type":"application/pdf",
   "x-ifund-document-meta":encodeURIComponent(JSON.stringify({
    file_name:"budget.pdf",purpose:"budget",summary:"Owner reviewed budget context",
    owner_excerpt:"",allow_agent_use:false
   }))}
 }),s.env,s.fetcher);
 assert.equal(posted.status,201,await posted.clone().text());
 const receipt=await posted.json();
 assert.match(receipt.id,/^[a-f0-9-]{36}$/);
 assert.equal(receipt.bytes,PDF.length);
 assert.equal(s.rows.size,1);assert.equal(s.objects.size,1);
 assert.match([...s.objects.keys()][0],new RegExp("^private/campaign-documents/"+OWNER+"/"+CAMPAIGN+"/"));
 const got=await routePrivateDocuments(s.request(base+"/"+receipt.id),s.env,s.fetcher);
 assert.equal(got.status,200);
 assert.deepEqual(new Uint8Array(await got.arrayBuffer()),PDF);
 const done=await routePrivateDocuments(s.request(base+"/"+receipt.id,"DELETE"),s.env,s.fetcher);
 assert.equal(done.status,204);
 assert.equal(s.objects.size,0);assert.equal(s.rows.size,0);
 assert.ok(s.trace.lastIndexOf("delete-r2")<s.trace.lastIndexOf("delete-db"));
});
test("another member cannot read or delete an owner's campaign documents",async()=>{
 const s=fixture(),base="/api/media/documents/"+CAMPAIGN;
 const create=await routePrivateDocuments(s.request(base,"POST",{
  body:PDF,headers:{"content-type":"application/pdf",
   "x-ifund-document-meta":encodeURIComponent(JSON.stringify({
    file_name:"budget.pdf",purpose:"general",summary:"",owner_excerpt:"",allow_agent_use:false
   }))}
 }),s.env,s.fetcher);
 assert.equal(create.status,201);
 const id=(await create.json()).id;
 for(const method of ["GET","DELETE"]){
  const response=await routePrivateDocuments(s.request(base+"/"+id,method,{token:TOKEN_B}),s.env,s.fetcher);
  assert.equal(response.status,404);
 }
 assert.equal(s.rows.size,1);assert.equal(s.objects.size,1);
});
test("failed R2 deletion preserves pending metadata, revokes agent use and allows safe retry",async()=>{
 const s=fixture({stuckDelete:true}),base="/api/media/documents/"+CAMPAIGN;
 const create=await routePrivateDocuments(s.request(base,"POST",{
  body:PDF,headers:{"content-type":"application/pdf",
   "x-ifund-document-meta":encodeURIComponent(JSON.stringify({
    file_name:"budget.pdf",purpose:"general",summary:"Owner authorizes references to this content.",
    owner_excerpt:"",allow_agent_use:true
   }))}
 }),s.env,s.fetcher);
 assert.equal(create.status,201);
 const {id}=await create.json();
 const result=await routePrivateDocuments(s.request(base+"/"+id,"DELETE"),s.env,s.fetcher);
 assert.equal(result.status,503);
 assert.equal(s.rows.get(id).allow_agent_use,false);
 assert.ok(s.rows.get(id).deletion_requested_at);
 assert.equal(s.objects.size,1);
 const hidden=await routePrivateDocuments(s.request(base+"/"+id),s.env,s.fetcher);
 assert.equal(hidden.status,404);
});
test("lost DB insert response never deletes R2 bytes after successful registration",async()=>{
 const s=fixture({saveThenLoseReceipt:true}),base="/api/media/documents/"+CAMPAIGN;
 const uploaded=await routePrivateDocuments(s.request(base,"POST",{
  body:PDF,headers:{"content-type":"application/pdf",
   "x-ifund-document-meta":encodeURIComponent(JSON.stringify({
    file_name:"budget.pdf",purpose:"general",summary:"",owner_excerpt:"",allow_agent_use:false
   }))}
 }),s.env,s.fetcher);
 assert.equal(uploaded.status,503);
 assert.equal(s.rows.size,1);
 assert.equal(s.objects.size,1);
});
test("failed metadata registration only cleans up an object after independently checking DB absence",async()=>{
 const s=fixture({failReceipt:true}),base="/api/media/documents/"+CAMPAIGN;
 const result=await routePrivateDocuments(s.request(base,"POST",{
  body:PDF,headers:{"content-type":"application/pdf",
   "x-ifund-document-meta":encodeURIComponent(JSON.stringify({
    file_name:"budget.pdf",purpose:"general",summary:"",owner_excerpt:"",allow_agent_use:false
   }))}
 }),s.env,s.fetcher);
 assert.equal(result.status,503);
 assert.equal(s.rows.size,0);
 assert.equal(s.objects.size,0);
});
test("unsigned or foreign-origin upload/deletion is fail-closed before R2 writes",async()=>{
 const s=fixture(),url="/api/media/documents/"+CAMPAIGN;
 const wrongOrigin=await routePrivateDocuments(s.request(url,"POST",{
  body:PDF,origin:"https://attacker.example",
  headers:{"content-type":"application/pdf",
   "x-ifund-document-meta":"%7B%7D"}
 }),s.env,s.fetcher);
 assert.equal(wrongOrigin.status,403);assert.equal(s.objects.size,0);
});
