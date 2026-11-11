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
    mode:"sandbox",enabled:false,webhook_ready:false,database_ready:false,live_payments_enabled:false
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

test("PayPal webhook ID is mandatory even if other sandbox settings exist",async()=>{
  const response=await call("status","GET",{...fakeConfig,PAYPAL_WEBHOOK_ID:""});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.enabled,false);
  assert.equal(body.webhook_ready,false);
  assert.equal(body.live_payments_enabled,false);
});

test("sandbox readiness calls PayPal and rejects unregistered webhook endpoints",async()=>{
 const oldFetch=globalThis.fetch;
 let calls=[];
 let databaseOk=true;
 const providerWebhook={id:fakeConfig.PAYPAL_WEBHOOK_ID,
   url:origin+"/api/paypal/sandbox/webhook",
   event_types:[{name:"PAYMENT.CAPTURE.COMPLETED"}]};
 try{
   globalThis.fetch=async (url,opts)=>{
     calls.push(String(url));
     if(String(url).endsWith("/v1/oauth2/token"))
       return Response.json({access_token:"dummy-test-token",token_type:"Bearer"});
     if(String(url).includes("/v1/notifications/webhooks/"))
       return Response.json(providerWebhook);
     if(String(url).includes("/rest/v1/ifund_paypal_sandbox_orders"))
       return databaseOk ? Response.json([]) : Response.json({message:"Service key rejected"},{status:401});
     throw Error("Unexpected provider request");
   };
   const ready=await call("status","GET",fakeConfig);
   assert.equal(ready.status,200);
   assert.deepEqual(await ready.json(),{mode:"sandbox",enabled:true,webhook_ready:true,database_ready:true,live_payments_enabled:false});
   assert.equal(calls.length,3);
   databaseOk=false;
   const databaseDown=await call("status","GET",fakeConfig);
   assert.deepEqual(await databaseDown.json(),{
     mode:"sandbox",enabled:false,webhook_ready:true,database_ready:false,live_payments_enabled:false
   });
   databaseOk=true;
   providerWebhook.url="https://attacker.example/api/paypal/sandbox/webhook";
   const blocked=await call("status","GET",fakeConfig);
   const body=await blocked.json();
   assert.equal(body.enabled,false);
   assert.equal(body.webhook_ready,false);
 }finally{globalThis.fetch=oldFetch}
});


test("unapproved sandbox order cannot trigger capture or write a receipt",async()=>{
 const previousFetch=globalThis.fetch;
 const {issueCheckoutBinding}=await import("../worker/paypalSandboxSecurity.js");
 const orderId="TESTORDER1234567",campaignId="a2251322-cac2-23ca-253e-274af4682a9a";
 const binding=await issueCheckoutBinding(orderId);
 const record={paypal_order_id:orderId,campaign_id:campaignId,gift_cents:100,
   status:"created",paypal_capture_id:null,checkout_token_hash:binding.checkoutTokenHash};
 let captureCalls=0,writeCalls=0;
 try{
  globalThis.fetch=async (url,options={})=>{
   const u=String(url);
   if(u.includes("/rest/v1/ifund_paypal_sandbox_orders")&&options.method==="GET")
     return Response.json([record]);
   if(u.endsWith("/v1/oauth2/token"))
     return Response.json({access_token:"test-only-sandbox-token",token_type:"Bearer"});
   if(u.endsWith("/v2/checkout/orders/"+orderId)&&options.method==="GET")
     return Response.json({id:orderId,status:"CREATED"});
   if(u.endsWith("/capture"))captureCalls++;
   if(options.method==="PATCH"||options.method==="POST"&&u.includes("/rest/v1/"))writeCalls++;
   throw Error("Unexpected external call: "+u);
  };
  const response=await call("capture","POST",fakeConfig,{order_id:orderId},{
   cookie:binding.setCookie.split(";")[0]
  });
  assert.equal(response.status,502,"a buyer must approve sandbox checkout");
  assert.equal((await response.json()).ok,false);
  assert.equal(captureCalls,0,"never call PayPal capture before buyer approval");
  assert.equal(writeCalls,0,"unapproved order cannot create a captured receipt");
 }finally{globalThis.fetch=previousFetch;}
});

test("verified sandbox webhook retry is idempotent and never reaches live tables",async()=>{
 const previousFetch=globalThis.fetch;
 const orderId="TESTORDER1234567",captureId="TESTCAPTURE1234567";
 const campaignId="a2251322-cac2-23ca-253e-274af4682a9a",eventId="TESTEVENT1234567";
 const amount={currency_code:"USD",value:"1.00"};
 const record={paypal_order_id:orderId,campaign_id:campaignId,gift_cents:100,
   status:"captured",paypal_capture_id:captureId,checkout_token_hash:"a".repeat(64)};
 const order={id:orderId,status:"COMPLETED",purchase_units:[{
   custom_id:campaignId,amount,payments:{captures:[{id:captureId,status:"COMPLETED",amount}]}
 }]};
 const event={id:eventId,event_type:"PAYMENT.CAPTURE.COMPLETED",
  resource:{id:captureId,amount,supplementary_data:{related_ids:{order_id:orderId}}}};
 const headers={
   "paypal-transmission-id":"test-transmission-id",
   "paypal-transmission-time":"2026-11-10T20:00:00Z",
   "paypal-cert-url":"https://api-m.sandbox.paypal.com/v1/notifications/certs/test",
   "paypal-auth-algo":"SHA256withRSA","paypal-transmission-sig":"test-signature"
 };
 let inserted=0;const written=[];
 try{
  globalThis.fetch=async(url,options={})=>{
   const u=String(url);
   if(u.endsWith("/v1/oauth2/token"))
     return Response.json({access_token:"test-only-sandbox-token",token_type:"Bearer"});
   if(u.endsWith("/v1/notifications/verify-webhook-signature"))
     return Response.json({verification_status:"SUCCESS"});
   if(u.endsWith("/v2/checkout/orders/"+orderId))
     return Response.json(order);
   if(u.includes("/rest/v1/ifund_paypal_sandbox_orders")&&options.method==="GET")
     return Response.json([record]);
   if(u.includes("/rest/v1/ifund_paypal_sandbox_events")&&options.method==="GET")
     return Response.json(inserted?[{paypal_event_id:eventId}]:[]);
   if(u.includes("/rest/v1/ifund_paypal_sandbox_events")&&options.method==="POST"){
     inserted++;written.push(JSON.parse(options.body));
     return Response.json([{paypal_event_id:eventId}]);
   }
   throw Error("Unexpected financial API call: "+u);
  };
  for(let attempt=0;attempt<2;attempt++){
   const result=await call("webhook","POST",fakeConfig,event,headers);
   assert.equal(result.status,200,"signed, provider-matched event accepted");
   assert.equal((await result.json()).verified,true);
  }
  assert.equal(inserted,1,"provider event must be stored exactly once");
  assert.equal(written[0].paypal_resource_id,captureId);
 }finally{globalThis.fetch=previousFetch;}
});
