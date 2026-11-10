import test from "node:test";
import assert from "node:assert/strict";
import {onRequest} from "../apps/web/functions/api/paypal/sandbox/[[path]].js";

const origin="https://unit-test.interplanetaryfund-migration.pages.dev";
const fakeConfig={
  IFUND_PAYPAL_SANDBOX_ENABLED:"enabled",PAYPAL_CLIENT_ID:"test-only-id",
  PAYPAL_CLIENT_SECRET:"test-only-not-a-real-secret",PAYPAL_WEBHOOK_ID:"test-only-webhook",
  SUPABASE_URL:"https://example.supabase.co",SUPABASE_SECRET_KEY:"test-only-key"
};
function call(path,method="POST",env={},body,extraHeaders={}){
  const request=new Request(origin+"/api/paypal/sandbox/"+path,{
    method,headers:{"content-type":"application/json",origin,...extraHeaders},
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  return onRequest({request,env,params:{path:[path]}});
}
test("sandbox status explicitly reports disabled without verified runtime bindings",async()=>{
  const response=await call("status","GET");
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{
    mode:"sandbox",enabled:false,webhook_ready:false,live_payments_enabled:false
  });
});
test("sandbox rejects order creation, capture and webhooks when secrets are missing",async()=>{
  for(const path of ["orders","capture","webhook"]){
    const response=await call(path,"POST",{}, {});
    assert.equal(response.status,503,path);
    assert.equal((await response.json()).ok,false);
  }
});
test("unexpected routes and methods cannot access payment operations",async()=>{
  assert.equal((await call("other")).status,404);
  assert.equal((await call("orders","GET")).status,405);
});
test("sandbox order creation requires exact same-origin preview POST",async()=>{
  const response=await call("orders","POST",fakeConfig,{}, {origin:"https://attacker.example"});
  assert.equal(response.status,403);
});
test("malformed browser JSON cannot produce payment success",async()=>{
  const request=new Request(origin+"/api/paypal/sandbox/orders",{
    method:"POST",headers:{"content-type":"text/plain",origin},body:"not JSON"
  });
  const response=await onRequest({request,env:fakeConfig,params:{path:["orders"]}});
  assert.equal(response.status>=400,true);
  assert.equal((await response.json()).ok,false);
});
test("unsigned webhooks are rejected before OAuth or any database writes",async()=>{
  const response=await call("webhook","POST",fakeConfig,{id:"EVENT-12345678"});
  assert.equal(response.status,400);
  assert.equal((await response.json()).ok,false);
});

test("oversized webhook payload is rejected before provider verification",async()=>{
  const request=new Request(origin+"/api/paypal/sandbox/webhook",{
    method:"POST",headers:{"content-type":"application/json",origin},
    body:"x".repeat(65537)
  });
  const result=await onRequest({request,env:fakeConfig,params:{path:["webhook"]}});
  assert.equal(result.status,413);
  assert.equal((await result.json()).ok,false);
});
