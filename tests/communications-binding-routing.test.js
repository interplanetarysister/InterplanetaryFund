import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";

test("Cloudflare Pages forwards ECHO workspace and messaging operations to the configured isolated service",async()=>{
  const routed=[];
  const env={IFUND_COMMUNICATIONS_AGENT:{fetch:async request=>{
    routed.push({url:request.url,method:request.method});
    return Response.json({gateway:"isolated-echo",delivery_available:false},{status:207});
  }}};
  for(const action of ["workspace","save","drafts","prepare-send","send"]){
    const request=new Request("https://ifund.test/api/agents/communications/"+action,{
      method:action==="workspace"?"GET":"POST",
      ...(action==="workspace"?{}:{headers:{"Content-Type":"application/json"},body:"{}"})
    });
    const response=await worker.fetch(request,env);
    assert.equal(response.status,207);
    assert.equal((await response.json()).gateway,"isolated-echo");
  }
  assert.equal(routed.length,5);
  assert.equal(routed[0].method,"GET");
  assert.equal(routed[4].method,"POST");
});
test("missing ECHO service binding cannot invent successful communications or sends",async()=>{
  const request=new Request("https://ifund.test/api/agents/communications/workspace");
  const response=await worker.fetch(request,{});
  assert.equal(response.status,503);
  const result=await response.json();
  assert.match(result.error,/not available/i);
});
