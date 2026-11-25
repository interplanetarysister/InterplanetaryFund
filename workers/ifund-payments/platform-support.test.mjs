// Synthetic read-only proof harness. Never calls PayPal or moves funds.
// Run: node --test workers/ifund-payments/platform-support.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";

const code=readFileSync(new URL("./worker.js",import.meta.url),"utf8");
const ORDER="ORDER12345678",CAPTURE="CAPTURE12345678";
const SUPPORT="11111111-1111-4111-8111-111111111111";
const CAMPAIGN="33333333-3333-4333-8333-333333333333";
const DONATION="44444444-4444-4444-8444-444444444444";
const CUSTOM="IFUND-PLATFORM-55555555-5555-4555-8555-555555555555";
const TOKEN="a".repeat(64);
const TOKEN_HASH=createHash("sha256").update(TOKEN).digest("hex");
const REQUEST_KEY="platform-support-test-0001";
const ORIGIN="https://interplanetaryfund.com";

const platformOrder=()=>({id:ORDER,status:"COMPLETED",purchase_units:[{
  reference_id:"ifund-platform-support",custom_id:CUSTOM,
  amount:{currency_code:"USD",value:"25.00"},
  payments:{captures:[{id:CAPTURE,status:"COMPLETED",
    amount:{currency_code:"USD",value:"25.00"},create_time:new Date(Date.now()-10000).toISOString()}]}
}]});
const campaignOrder=()=>({id:ORDER,status:"COMPLETED",purchase_units:[{
  reference_id:CAMPAIGN,custom_id:["ifund",CAMPAIGN,2500,0,"paypal"].join("|"),
  amount:{currency_code:"USD",value:"25.00"},
  payments:{captures:[{id:CAPTURE,status:"COMPLETED",
    amount:{currency_code:"USD",value:"25.00"}}]}
}]});
const intent=()=>({support_id:SUPPORT,custom_id:CUSTOM,amount_cents:2500,
  currency:"USD",environment:"live",status:"created",
  checkout_token_hash:TOKEN_HASH,payment_channel:"paypal",paypal_capture_id:null});
const campaignIntent=()=>({campaign_id:CAMPAIGN,gift_cents:2500,
  optional_support_cents:0,total_cents:2500,environment:"live",status:"created",
  checkout_token_hash:TOKEN_HASH,payment_channel:"paypal",paypal_capture_id:null});

function harness(options={}) {
  const requests=[],writes=[];
  const state={
    order:options.order||platformOrder(),
    begin:options.begin||{ok:true,support_id:SUPPORT,custom_id:CUSTOM,status:"initiated",order_id:null},
    intent:options.intent===undefined?intent():options.intent,
    campaignIntent:options.campaignIntent===undefined?campaignIntent():options.campaignIntent,
    lookupThrows:options.lookupThrows||false,
    captureThrows:options.captureThrows||false,
  };
  const context=vm.createContext({
    Response,Request,URL,TextEncoder,TextDecoder,crypto:globalThis.crypto,
    btoa,atob,Date,console
  });
  vm.runInContext(code.replace("export default {","globalThis.__worker = {"),context);
  context.__paypal=async(_env,path,method="GET",_body,requestId)=>{
    requests.push({path,method,requestId});
    if(method==="POST"&&path==="/v1/notifications/verify-webhook-signature")
      return {verification_status:"SUCCESS"};
    if(method==="GET"&&path.startsWith("/v2/checkout/orders/"))return state.order;
    if(method==="POST"&&path==="/v2/checkout/orders")return {id:ORDER,status:"CREATED"};
    if(method==="POST"&&path.endsWith("/capture")){
      if(state.captureThrows)throw new Error("provider timeout");
      return {id:ORDER,status:"COMPLETED"};
    }
    throw new Error("Provider call not stubbed: "+method+" "+path);
  };
  context.__ledger=async(_env,op,payload)=>{
    writes.push({op,payload});
    if(op==="platform_support_begin")return state.begin;
    if(op==="platform_support_bind")return {ok:true};
    if(op==="platform_support_get")return {ok:true,intent:state.intent};
    if(op==="platform_support_lookup"){
      if(state.lookupThrows)throw new Error("ledger_rejected");
      return {ok:true,intent:state.intent};
    }
    if(op==="platform_support_finalize")
      return {ok:true,support_id:SUPPORT,status:"captured",duplicate:false};
    if(op==="platform_support_event")return {ok:true,recorded:true};
    if(op==="get")return {ok:true,intent:state.campaignIntent};
    if(op==="finalize")return {ok:true,donation_id:DONATION};
    if(op==="event")return {ok:true,recorded:true};
    throw new Error("Unexpected broker op "+op);
  };
  context.__atomic=async()=>({ready:true,merchant_id:"MERCHANT12345"});
  vm.runInContext("paypal=__paypal;signLedger=__ledger;subscriptionAtomicReadiness=__atomic;",context);
  return {fn:name=>vm.runInContext(name,context),worker:context.__worker,requests,writes,state};
}
const createBody=(over={})=>({amount_cents:2500,request_key:REQUEST_KEY,
  payment_channel:"card",checkout_token:TOKEN,...over});
const createRequest=(over={},headers={})=>new Request(ORIGIN+"/api/payments/platform-support/create-order",{
  method:"POST",headers:{"content-type":"application/json",...headers},
  body:JSON.stringify(createBody(over))
});
const captureRequest=(over={})=>new Request(ORIGIN+"/api/payments/platform-support/capture-order",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({order_id:ORDER,checkout_token:TOKEN,...over})
});

test("create rejects a campaign_id outright instead of ignoring it",async()=>{
  const h=harness();
  const response=await h.fn("createPlatformSupportOrder")(createRequest({campaign_id:CAMPAIGN}),{});
  assert.equal(response.status,400);
  assert.equal((await response.json()).error,"invalid_platform_support_request");
  assert.equal(h.requests.length,0);
  assert.equal(h.writes.length,0);
});

for(const [label,over] of [
  ["zero amount",{amount_cents:0}],
  ["below minimum",{amount_cents:99}],
  ["above maximum",{amount_cents:100000001}],
  ["fractional amount",{amount_cents:25.5}],
  ["string amount",{amount_cents:"25"}],
  ["missing amount",{amount_cents:undefined}],
  ["short request key",{request_key:"short"}],
  ["unknown channel",{payment_channel:"bitcoin"}],
])test("create validation rejects "+label,async()=>{
  const h=harness();
  const response=await h.fn("createPlatformSupportOrder")(createRequest(over),{});
  assert.equal(response.status,400);
  assert.equal((await response.json()).error,"invalid_platform_support_request");
  assert.equal(h.requests.length,0);
  assert.equal(h.writes.length,0);
});

test("create validation rejects a malformed checkout token with its own code",async()=>{
  const h=harness();
  const response=await h.fn("createPlatformSupportOrder")(
    createRequest({checkout_token:"not-hex"}),{});
  assert.equal(response.status,400);
  assert.equal((await response.json()).error,"invalid_checkout_token");
  assert.equal(h.requests.length,0);
  assert.equal(h.writes.length,0);
});

test("guest create succeeds without an Authorization header",async()=>{
  const h=harness();
  const response=await h.fn("createPlatformSupportOrder")(createRequest(),{});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.id,ORDER);
  assert.equal(body.support_id,SUPPORT);
  assert.equal(body.amount_cents,2500);
  assert.equal(body.currency,"USD");
  assert.equal(body.checkout_token,TOKEN);
  assert.equal(body.campaign_id,undefined);
  assert.deepEqual(h.writes.map(x=>x.op),["platform_support_begin","platform_support_bind"]);
  assert.equal(h.writes[0].payload.donor_access_token,null);
  assert.equal(h.writes[0].payload.amount_cents,2500);
  assert.equal(h.writes[0].payload.total_cents,2500);
  assert.equal(h.writes[0].payload.campaign_id,undefined);
  assert.equal(h.requests.length,1);
  assert.equal(h.requests[0].path,"/v2/checkout/orders");
  assert.equal(h.requests[0].method,"POST");
  assert.equal(h.requests[0].requestId,REQUEST_KEY);
});

test("signed-in donor token reaches the ledger and no client donor id is trusted",async()=>{
  const h=harness();
  const token="x".repeat(45);
  const authed=await h.fn("createPlatformSupportOrder")(new Request(
    ORIGIN+"/api/payments/platform-support/create-order",{method:"POST",
      headers:{"content-type":"application/json","authorization":"Bearer "+token},
      body:JSON.stringify(createBody({donor_id:"attacker-chosen-id"}))}),{});
  assert.equal(authed.status,200);
  assert.equal((await authed.json()).support_id,SUPPORT);
  assert.equal(h.writes[0].payload.donor_access_token,token);
  assert.equal(h.writes[0].payload.donor_id,undefined);
});

test("retry with the same request key returns the bound order without a second PayPal order",async()=>{
  const h=harness({begin:{ok:true,support_id:SUPPORT,custom_id:CUSTOM,
    status:"created",order_id:ORDER}});
  const response=await h.fn("createPlatformSupportOrder")(createRequest(),{});
  assert.equal(response.status,200);
  assert.equal((await response.json()).id,ORDER);
  assert.equal(h.requests.length,0);
  assert.deepEqual(h.writes.map(x=>x.op),["platform_support_begin"]);
});

test("capture verifies the provider receipt before finalizing",async()=>{
  const h=harness();
  const response=await h.fn("capturePlatformSupportOrder")(captureRequest(),{});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.status,"captured");
  assert.equal(body.support_id,SUPPORT);
  assert.equal(body.order_id,ORDER);
  assert.equal(body.capture_id,CAPTURE);
  assert.equal(h.requests[0].path.endsWith("/capture"),true);
  assert.equal(h.requests[1].path,"/v2/checkout/orders/"+ORDER);
  assert.deepEqual(h.writes.map(x=>x.op),["platform_support_get","platform_support_finalize"]);
  assert.equal(h.writes[1].payload.support_id,SUPPORT);
  assert.equal(h.writes[1].payload.paypal_capture_id,CAPTURE);
  assert.equal(h.writes[1].payload.custom_id,CUSTOM);
});

test("capture with a wrong checkout token is refused before any provider call",async()=>{
  const h=harness();
  const response=await h.fn("capturePlatformSupportOrder")(captureRequest({checkout_token:"b".repeat(64)}),{});
  assert.equal(response.status,403);
  assert.equal((await response.json()).error,"checkout_not_authorized");
  assert.equal(h.requests.length,0);
  assert.equal(h.writes.filter(x=>x.op==="platform_support_finalize").length,0);
});

for(const [label,mutate] of [
  ["wrong custom identity",o=>{o.purchase_units[0].custom_id="OTHER";}],
  ["campaign reference id",o=>{o.purchase_units[0].reference_id=CAMPAIGN;}],
  ["wrong amount",o=>{o.purchase_units[0].payments.captures[0].amount.value="26.00";}],
  ["unsettled capture",o=>{o.purchase_units[0].payments.captures[0].status="PENDING";}],
  ["uncompleted order",o=>{o.status="APPROVED";}],
  ["multiple captures",o=>{o.purchase_units[0].payments.captures.push({...o.purchase_units[0].payments.captures[0]});}]
])test("capture fails closed when the provider receipt has "+label,async()=>{
  const o=platformOrder();mutate(o);
  const h=harness({order:o});
  await assert.rejects(h.fn("capturePlatformSupportOrder")(captureRequest(),{}));
  assert.equal(h.writes.filter(x=>x.op==="platform_support_finalize").length,0);
});

test("capture after a provider timeout still finalizes from provider evidence",async()=>{
  const h=harness({captureThrows:true});
  const response=await h.fn("capturePlatformSupportOrder")(captureRequest(),{});
  assert.equal(response.status,200);
  assert.equal((await response.json()).status,"captured");
  assert.equal(h.writes.filter(x=>x.op==="platform_support_finalize").length,1);
});

test("verifyPlatformSupportCapture rejects a campaign order",async()=>{
  const h=harness({order:campaignOrder()});
  await assert.rejects(h.fn("verifyPlatformSupportCapture")({},ORDER,intent()));
  assert.equal(h.writes.length,0);
});

const webhookHeaders=()=>new Map([
  ["paypal-transmission-id","test-id"],
  ["paypal-transmission-time","2026-11-15T12:00:00Z"],
  ["paypal-cert-url","https://api-m.paypal.com/cert"],
  ["paypal-auth-algo","SHA256withRSA"],
  ["paypal-transmission-sig","synthetic-signature"],
]);
async function runWebhook(h,event){
  return h.fn("webhook")(
    {text:async()=>JSON.stringify(event),
     headers:{get:k=>webhookHeaders().get(k)}},
    {PAYPAL_WEBHOOK_ID:"synthetic-webhook-id",IFUND_PAYPAL_MODE:"live"});
}

test("webhook PAYMENT.CAPTURE.COMPLETED for a platform order finalizes and records the event",async()=>{
  const h=harness();
  const event={id:"WH-EVENT-1234567",event_type:"PAYMENT.CAPTURE.COMPLETED",
    resource:{id:CAPTURE,supplementary_data:{related_ids:{order_id:ORDER}}}};
  const response=await runWebhook(h,event);
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.ok,true);
  assert.equal(body.recorded,true);
  assert.equal(body.support_id,SUPPORT);
  assert.deepEqual(h.writes.map(x=>x.op),
    ["platform_support_lookup","platform_support_finalize","platform_support_event"]);
  assert.equal(h.writes.filter(x=>x.op==="get").length,0);
  assert.equal(h.writes[2].payload.paypal_event_id,"WH-EVENT-1234567");
});

test("webhook PAYMENT.CAPTURE.COMPLETED for a campaign order falls through to the campaign path",async()=>{
  const h=harness({order:campaignOrder(),lookupThrows:true});
  const event={id:"WH-EVENT-1234567",event_type:"PAYMENT.CAPTURE.COMPLETED",
    resource:{id:CAPTURE,supplementary_data:{related_ids:{order_id:ORDER}}}};
  const response=await runWebhook(h,event);
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.ok,true);
  assert.equal(body.recorded,true);
  assert.equal(body.donation_id,DONATION);
  assert.equal(h.writes.filter(x=>x.op==="platform_support_finalize").length,0);
  assert.deepEqual(h.writes.map(x=>x.op),["platform_support_lookup","get","finalize","event"]);
});

test("webhook PAYMENT.CAPTURE.REFUNDED for a platform capture fails closed without ledger writes",async()=>{
  const h=harness();
  const event={id:"WH-EVENT-1234567",event_type:"PAYMENT.CAPTURE.REFUNDED",
    resource:{id:"REFUND12345",supplementary_data:{related_ids:{capture_id:CAPTURE}},
      amount:{currency_code:"USD",value:"25.00"}}};
  const response=await runWebhook(h,event);
  assert.equal(response.status,503);
  assert.equal((await response.json()).error,"capture_refund_atomic_ledger_unavailable");
  assert.equal(h.writes.length,0);
});

test("fetch routes sit behind the payments gate and the origin allowlist",async()=>{
  const env={IFUND_PAYMENTS_ENABLED:"false",IFUND_PAYPAL_MODE:"live",
    IFUND_ALLOWED_ORIGINS:ORIGIN};
  const h=harness();
  const disabled=await h.worker.fetch(createRequest(),env);
  assert.equal(disabled.status,503);
  assert.equal((await disabled.json()).error,"payments_disabled");
  assert.equal(h.writes.length,0);
  const wrongOrigin=await h.worker.fetch(new Request(
    ORIGIN+"/api/payments/platform-support/create-order",{method:"POST",
      headers:{"content-type":"application/json","origin":"https://evil.example"},
      body:JSON.stringify(createBody())}),
    {IFUND_PAYMENTS_ENABLED:"true",IFUND_PAYPAL_MODE:"live",IFUND_ALLOWED_ORIGINS:ORIGIN});
  assert.equal(wrongOrigin.status,403);
  assert.equal((await wrongOrigin.json()).error,"origin_not_allowed");
  const enabled=await h.worker.fetch(new Request(
    ORIGIN+"/api/payments/platform-support/create-order",{method:"POST",
      headers:{"content-type":"application/json","origin":ORIGIN},
      body:JSON.stringify(createBody())}),
    {IFUND_PAYMENTS_ENABLED:"true",IFUND_PAYPAL_MODE:"live",IFUND_ALLOWED_ORIGINS:ORIGIN});
  assert.equal(enabled.status,200);
  assert.equal((await enabled.json()).id,ORDER);
  const captureDisabled=await h.worker.fetch(captureRequest(),env);
  assert.equal(captureDisabled.status,503);
  assert.equal((await captureDisabled.json()).error,"payments_disabled");
});
