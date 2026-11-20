import test from "node:test";
import assert from "node:assert/strict";
import ifundApi from "../../../worker/index.js";

test("Studio generation and status use isolated AI service, without privileged caller bypass",async()=>{
 for(const [path,method] of [["/api/studio/status","GET"],["/api/studio/generate","POST"]]){
  let called=0;
  const req=new Request("https://ifund.example"+path,{
   method,headers:method==="POST"?{"content-type":"application/json"}:{},
   ...(method==="POST"?{body:JSON.stringify({prompt:"Create a campaign support page"})}:{})
  });
  const env={IFUND_STUDIO_AI_SERVICE:{fetch:async request=>{
   called++;
   assert.equal(new URL(request.url).pathname,path);
   assert.equal(request.headers.get("authorization"),null);
   return Response.json({error:"Sign in with an administrator account."},{status:401});
  }}};
  const res=await ifundApi.fetch(req,env);
  assert.equal(called,1);
  assert.equal(res.status,401);
 }
});
test("missing Studio AI binding stays disabled, even with general page builder enabled",async()=>{
 const env={IFUND_STUDIO_ENABLED:"enabled",IFUND_STUDIO_AI_ENABLED:"disabled",SUPABASE_URL:"https://example.supabase.co",SUPABASE_PUBLISHABLE_KEY:"sb_publishable_test"};
 const res=await ifundApi.fetch(new Request("https://ifund.example/api/studio/generate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({prompt:"Build an accessible landing page"})}),env);
 assert.equal(res.status,503);
});
