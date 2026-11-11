import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const source = readFileSync(new URL("../../../workers/ifund-payments/worker.js", import.meta.url), "utf8")
  .replace("export default {", "globalThis.__paymentWorker = {");

async function makeHarness(event, { intent = null, providerOrder = null } = {}) {
  const ledger = [];
  const keys = await webcrypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
  const jwk = await webcrypto.subtle.exportKey("jwk", keys.privateKey);
  const sandbox = { crypto:webcrypto, TextEncoder, URL, Response, Request, atob, btoa, console };
  sandbox.fetch = async (url, options) => {
    const u = String(url);
    if (u.endsWith("/v1/oauth2/token")) return Response.json({access_token:"test-token"});
    if (u.endsWith("/v1/notifications/verify-webhook-signature")) return Response.json({verification_status:"SUCCESS"});
    if (u.includes("/v2/checkout/orders/")) return Response.json(providerOrder||{});
    if (u.endsWith("/functions/v1/ifund-payment-ledger")) {
      const body = JSON.parse(options.body);
      ledger.push(body);
      if(body.op==="get") return Response.json({ok:true,intent});
      if(body.op==="finalize") return Response.json({ok:true,donation_id:"verified-donation-id"});
      if(body.op==="reverse") return Response.json({ok:true,donation_id:"verified-donation-id"});
      if(body.op==="event") return Response.json({ok:true,recorded:true});
      return Response.json({ok:false},{status:400});
    }
    throw new Error("Unexpected request: "+u);
  };
  vm.runInNewContext(source,sandbox,{filename:"worker.js"});
  const env={
    IFUND_PAYMENTS_ENABLED:"false", IFUND_PAYPAL_MODE:"live",
    IFUND_SUPABASE_URL:"https://db.example.test",PAYPAL_CLIENT_ID:"test-id",
    PAYPAL_CLIENT_SECRET:"test-secret", PAYPAL_WEBHOOK_ID:"test-webhook",
    IFUND_PAYMENTS_EDGE_SIGNING_PRIVATE_JWK:JSON.stringify(jwk)
  };
  const headers={
    "paypal-transmission-id":"test-transmission", "paypal-transmission-time":"2026-11-10T00:00:00Z",
    "paypal-cert-url":"https://api.paypal.com/cert", "paypal-auth-algo":"SHA256withRSA",
    "paypal-transmission-sig":"provider-test-signature"
  };
  const request=new Request("https://ifund.test/api/payments/webhook",
    {method:"POST",headers,body:JSON.stringify(event)});
  return {ledger, response:()=>sandbox.__paymentWorker.fetch(request,env)};
}

const orderId="123456789ORDER", captureId="123456789CAPTURE", eventId="WH-EVENT-123456";
const reversal={id:eventId,event_type:"PAYMENT.CAPTURE.REFUNDED",resource:{
  // PayPal refund events identify the refund in resource.id, and reference
  // the originating capture through a verified rel=up API link.
  id:"RFND-123456789",status:"COMPLETED",
  links:[{rel:"up",href:"https://api-m.paypal.com/v2/payments/captures/"+captureId}],
  amount:{currency_code:"USD",value:"1.00"}
}};
test("verified webhook reversal forwards required cents to atomic ledger",async()=>{
  const h=await makeHarness(reversal);
  const response=await h.response();
  assert.equal(response.status,200);
  assert.equal(h.ledger.length,1);
  assert.equal(h.ledger[0].op,"reverse");
  assert.equal(h.ledger[0].data.refunded_cents,100);
  assert.equal(h.ledger[0].data.paypal_capture_id,captureId);
});
test("invalid reversal amount fails closed without a ledger mutation",async()=>{
  const h=await makeHarness({...reversal,resource:{...reversal.resource,amount:{currency_code:"EUR",value:"1.00"}}});
  const response=await h.response();
  assert.equal(response.status,409);
  assert.equal(h.ledger.length,0);
});
test("untrusted refund capture links do not reach the ledger",async()=>{
  const h=await makeHarness({...reversal,resource:{...reversal.resource,
    links:[{rel:"up",href:"https://evil.example/v2/payments/captures/"+captureId}]}});
  const response=await h.response();
  assert.equal(response.status,409);
  assert.equal(h.ledger.length,0);
});
test("conflicting signed refund identifiers fail closed",async()=>{
  const h=await makeHarness({...reversal,resource:{...reversal.resource,
    supplementary_data:{related_ids:{capture_id:"DIFFERENT123456"}}}});
  const response=await h.response();
  assert.equal(response.status,409);
  assert.equal(h.ledger.length,0);
});
test("mismatched signed capture never finalizes a donation",async()=>{
  const campaign="a48d705e-2118-4464-b97d-605e116d91d2";
  const intent={campaign_id:campaign,gift_cents:100,optional_support_cents:0,
    total_cents:155,payment_channel:"paypal",status:"created",environment:"live"};
  const order={status:"COMPLETED",purchase_units:[{
    reference_id:campaign,custom_id:"ifund|"+campaign+"|100|0|paypal",
    payments:{captures:[{id:captureId,status:"COMPLETED",amount:{currency_code:"USD",value:"1.55"}}]}
  }]};
  const event={id:eventId,event_type:"PAYMENT.CAPTURE.COMPLETED",resource:{
    id:"DIFFERENT123456",supplementary_data:{related_ids:{order_id:orderId}}
  }};
  const h=await makeHarness(event,{intent,providerOrder:order});
  const response=await h.response();
  assert.equal(response.status,409);
  assert.deepEqual(h.ledger.map(e=>e.op),["get"]);
});
test("verified completed-capture webhook creates a separate idempotent event receipt",async()=>{
  const campaign="a48d705e-2118-4464-b97d-605e116d91d2";
  const intent={campaign_id:campaign,gift_cents:100,optional_support_cents:0,
    total_cents:155,payment_channel:"paypal",status:"created",environment:"live"};
  const order={status:"COMPLETED",purchase_units:[{
    reference_id:campaign,custom_id:"ifund|"+campaign+"|100|0|paypal",
    payments:{captures:[{id:captureId,status:"COMPLETED",amount:{currency_code:"USD",value:"1.55"}}]}
  }]};
  const event={id:eventId,event_type:"PAYMENT.CAPTURE.COMPLETED",resource:{
    id:captureId,supplementary_data:{related_ids:{order_id:orderId}}
  }};
  const h=await makeHarness(event,{intent,providerOrder:order});
  const response=await h.response();
  assert.equal(response.status,200);
  assert.deepEqual(h.ledger.map(e=>e.op),["get","finalize","event"]);
  assert.equal(h.ledger[2].data.paypal_event_id,eventId);
});

test("disabled live payment mode refuses provider capture before ledger or PayPal calls",async()=>{
  let outgoing=0;
  const sandbox={crypto:webcrypto,TextEncoder,URL,Response,Request,atob,btoa,console,
    fetch:async()=>{outgoing++;throw Error("Network must not be contacted");}};
  vm.runInNewContext(source,sandbox,{filename:"worker.js"});
  const request=new Request("https://interplanetaryfund.com/api/payments/capture-order",{
    method:"POST",headers:{origin:"https://interplanetaryfund.com","content-type":"application/json"},
    body:JSON.stringify({order_id:orderId,checkout_token:"a".repeat(64)})
  });
  for(const settings of [
    {IFUND_PAYMENTS_ENABLED:"false",IFUND_PAYPAL_MODE:"live"},
    {IFUND_PAYMENTS_ENABLED:"true",IFUND_PAYPAL_MODE:"sandbox"}
  ]){
    const response=await sandbox.__paymentWorker.fetch(request.clone(),{
      ...settings,IFUND_ALLOWED_ORIGINS:"https://interplanetaryfund.com"});
    assert.equal(response.status,503);
    assert.equal((await response.json()).error,"payments_disabled");
  }
  assert.equal(outgoing,0,"disabled checkout must not access PayPal or mutate the ledger");
});
