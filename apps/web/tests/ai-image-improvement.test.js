import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { routeImageImprove, IMAGE_EDIT_MODEL } from "../../../worker/imageImprove.js";
import { decodeGeneratedArtwork } from "../src/lib/imageArtwork.mjs";

const owner="11111111-1111-4111-8111-111111111111";
const url="https://interplanetaryfund.com/api/ai/images/improve";
// A bounded synthetic JPEG-like fixture with SOI/EOI markers and >=64 bytes.
// This unit test mocks the provider; it does not prove a real AI image was produced.
const referenceBytes = Buffer.alloc(128, 0);
referenceBytes.set([0xff, 0xd8, 0xff], 0);
referenceBytes.set([0xff, 0xd9], 126);
const input={title:"Help a family recover",description:"Illustrate safe housing and support after a disaster",style:"comic",reference_jpeg:referenceBytes.toString("base64"),confirmed_rights:true};
const env={IFUND_IMAGE_AI_ENABLED:"enabled",SUPABASE_URL:"https://ssibsfmtodgximseeqsv.supabase.co",SUPABASE_PUBLISHABLE_KEY:"sb_publishable_mock_public"};
const request=(body=input,method="POST")=>new Request(url,{method,headers:method==="POST"?{"Content-Type":"application/json",Authorization:"Bearer good.mock.token"}:{},...(method==="POST"?{body:JSON.stringify(body)}:{})});
function services(quota=true,verified=true) {
 const calls=[];
 const fetcher=async (destination,init)=>{
  calls.push(destination);
  if(destination.endsWith("/auth/v1/user")) return Response.json(verified?{id:owner,app_metadata:{role:"member"}}:{},{status:verified?200:401});
  if(destination.endsWith("/rpc/ifund_ai_image_consume_free_quota")) return Response.json(quota);
  throw Error("Unexpected remote request");
 };
 return {calls,fetcher};
}

test("a real member's explicitly approved small reference photo reaches the configured Workers AI model only after quota",async()=>{
 const svc=services();
 const enabled={...env,AI:{run:async (model,args)=>{
  assert.equal(model,IMAGE_EDIT_MODEL);
  assert.equal(args.multipart.contentType.startsWith("multipart/form-data; boundary="),true);
  assert.equal(svc.calls.length,2,"member verification and quota must precede inference");
  const body=await new Response(args.multipart.body).text();
  assert.ok(body.includes('name="input_image_0"'));
  assert.ok(body.includes('name="prompt"'));
  assert.ok(body.includes('name="width"'));
  assert.ok(body.includes('name="height"'));
  return {image:input.reference_jpeg};
 }}};
 const res=await routeImageImprove(request(),enabled,svc.fetcher);
 assert.equal(res.status,200);
 const payload=await res.json();
 assert.equal(payload.improved,true);
 assert.equal(payload.mime_type,"image/jpeg");
 assert.equal(payload.image_base64,input.reference_jpeg);
 assert.equal(payload.model,IMAGE_EDIT_MODEL);
 assert.equal(JSON.stringify(payload).includes(owner),false);
});

test("unapproved references, malformed files and requests are rejected before quota or model use",async()=>{
 const svc=services();
 const noAI={run:async()=>{throw Error("AI must not be invoked");}};
 for(const bad of [
  {...input,confirmed_rights:false},
  {...input,confirmed_rights:"yes"},
  {...input,reference_jpeg:"not-jpeg"},
  {...input,reference_jpeg:"/9j/"+"A".repeat(1_050_000)},
  {...input,another_key:"not allowed"},
 ]) {
  const res=await routeImageImprove(request(bad),{...env,AI:noAI},svc.fetcher);
  assert.equal(res.status,422);
 }
 assert.equal(svc.calls.length,0);
 assert.equal((await routeImageImprove(request(),{...env,AI:noAI,IFUND_IMAGE_AI_ENABLED:"off"})).status,503);
 assert.equal((await routeImageImprove(request(null,"GET"),{...env,AI:noAI})).status,405);
});

test("image improvement fails closed on quota, identity, provider output errors",async()=>{
 const ai={run:async()=>{throw Error("AI cannot run before quota");}};
 assert.equal((await routeImageImprove(request(),{...env,AI:ai},services(false).fetcher)).status,429);
 assert.equal((await routeImageImprove(request(),{...env,AI:ai},services(true,false).fetcher)).status,401);
 const broken={...env,AI:{run:async()=>({image:"not-jpeg"})}};
 assert.equal((await routeImageImprove(request(),broken,services().fetcher)).status,502);
});

test("frontend strips EXIF through canvas and requires image rights consent",()=>{
 const page=readFileSync(new URL("../src/pages/AIImageStudio.jsx",import.meta.url),"utf8");
 const helper=readFileSync(new URL("../src/lib/imageArtwork.mjs",import.meta.url),"utf8");
 const router=readFileSync(new URL("../../../worker/index.js",import.meta.url),"utf8");
 assert.match(page,/prepareReferenceJpeg\(referenceFile\)/);
 assert.match(page,/confirmed_rights: true/);
 assert.match(page,/I have permission to edit this image/);
 assert.match(helper,/canvas\.toDataURL\("image\/jpeg"/);
 assert.match(helper,/480 \/ width/);
 assert.match(router,/routeImageImprove\(request, env\)/);
 const decoded=decodeGeneratedArtwork({generated:true,mime_type:"image/jpeg",image_base64:input.reference_jpeg});
 assert.equal(decoded[0],255);
 assert.equal(decoded[1],216);
 assert.equal(decoded[2],255);
});
