// Synthetic read-only proof harness. Never calls PayPal or moves funds.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";

const code=readFileSync(new URL("./worker.js",import.meta.url),"utf8");
const ORDER="ORDER12345678",CAPTURE="CAPTURE12345678";
const PURCHASE="11111111-1111-4111-8111-111111111111";
const MEMBER="22222222-2222-4222-8222-222222222222";
const CUSTOM="IFUND-PREMIUM-33333333-3333-4333-8333-333333333333";
const time=()=>new Date(Date.now()-10000).toISOString();
const purchase=()=>({id:PURCHASE,member_id:MEMBER,status:"created",
  paypal_order_id:ORDER,custom_id:CUSTOM,amount_cents:499,currency:"USD",environment:"live"});
const providerOrder=()=>({id:ORDER,status:"COMPLETED",purchase_units:[{
  reference_id:"ifund-premium-one-time",custom_id:CUSTOM,
  payee:{merchant_id:"MERCHANT12345"},
  amount:{currency_code:"USD",value:"4.99"},
  payments:{captures:[{id:CAPTURE,status:"COMPLETED",
    amount:{currency_code:"USD",value:"4.99"},create_time:time()}]}
}]});
function harness(order=providerOrder()){
  const requests=[],writes=[];
  const context=vm.createContext({
    Response,Request,URL,TextEncoder,TextDecoder,crypto:globalThis.crypto,
    btoa,atob,Date,console
  });
  vm.runInContext(code.replace("export default {","globalThis.__worker = {"),context);
  context.__paypal=async(_env,path,method="GET")=>{
    requests.push({path,method});
    if(method==="GET"&&path.includes("/v2/checkout/orders/"))return order;
    if(method==="POST"&&path.endsWith("/capture"))return {id:ORDER,status:"COMPLETED"};
    throw Error("Provider call not stubbed");
  };
  context.__ledger=async(_env,op,payload)=>{
    writes.push({op,payload});
    if(op==="premium_one_time_get")return {purchase:purchase()};
    if(op==="premium_one_time_finalize")return {ok:true,status:"captured",valid_until:"2026-12-23T03:00:00Z"};
    if(op==="premium_one_time_begin")return {purchase_id:PURCHASE,custom_id:CUSTOM,status:"initiated"};
    if(op==="premium_one_time_bind")return {ok:true};
    throw Error("Unexpected broker op "+op);
  };
  context.__atomic=async()=>({ready:true,merchant_id:"MERCHANT12345"});
  vm.runInContext("paypal=__paypal;signLedger=__ledger;subscriptionAtomicReadiness=__atomic;",context);
  return {fn:name=>vm.runInContext(name,context),requests,writes};
}
test("Premium one-time checkout is closed without explicit enablement",()=>{
  const h=harness();
  const enabled=h.fn("premiumOneTimeEnabled");
  assert.equal(enabled({IFUND_PAYMENTS_ENABLED:"true",IFUND_PAYPAL_MODE:"live"}),false);
  assert.equal(enabled({IFUND_PREMIUM_ONE_TIME_ENABLED:"true",IFUND_PAYMENTS_ENABLED:"true",IFUND_PAYPAL_MODE:"live"}),true);
});
test("verified $4.99 receipt has immutable merchant, order, custom id, capture and time",async()=>{
  const h=harness();
  const proof=await h.fn("verifyPremiumOneTimeCapture")({},ORDER,purchase());
  assert.equal(proof.paypal_capture_id,CAPTURE);
  assert.equal(proof.merchant_id,"MERCHANT12345");
  assert.equal(proof.custom_id,CUSTOM);
  assert.equal(proof.purchase_id,PURCHASE);
  assert.equal(h.requests.length,1);
  assert.equal(h.writes.length,0);
});
for(const [label,mutate] of [
  ["wrong merchant",o=>{o.purchase_units[0].payee.merchant_id="OTHER";}],
  ["wrong amount",o=>{o.purchase_units[0].amount.value="499.00";}],
  ["wrong capture amount",o=>{o.purchase_units[0].payments.captures[0].amount.value="5.00";}],
  ["wrong custom identity",o=>{o.purchase_units[0].custom_id="OTHER";}],
  ["unsettled capture",o=>{o.purchase_units[0].payments.captures[0].status="PENDING";}],
  ["multiple captures",o=>{o.purchase_units[0].payments.captures.push({...o.purchase_units[0].payments.captures[0]});}]
])test("Provider "+label+" cannot activate Premium",async()=>{
  const o=providerOrder();mutate(o);
  const h=harness(o);
  await assert.rejects(h.fn("verifyPremiumOneTimeCapture")({},ORDER,purchase()));
  assert.equal(h.writes.length,0);
});
test("Capture POST only finalizes after provider-backed receipt check",async()=>{
  const h=harness();
  const request=new Request("https://interplanetaryfund.com/api/payments/premium-one-time/capture-order",{
    method:"POST",
    headers:{"authorization":"Bearer "+"x".repeat(45)},
    body:JSON.stringify({order_id:ORDER,checkout_token:"a".repeat(64)})
  });
  const result=await h.fn("capturePremiumOneTime")(request,{});
  assert.equal(result.status,200);
  const body=await result.json();
  assert.equal(body.status,"captured");
  assert.equal(h.requests[0].path.endsWith("/capture"),true);
  assert.equal(h.requests[1].path.endsWith("/"+ORDER),true);
  assert.deepEqual(h.writes.map(x=>x.op),["premium_one_time_get","premium_one_time_finalize"]);
});
test("Payment does not finalize when PayPal receipt mismatches",async()=>{
  const o=providerOrder();o.purchase_units[0].payee.merchant_id="INVALID";
  const h=harness(o);
  const request=new Request("https://interplanetaryfund.com/api/payments/premium-one-time/capture-order",{
    method:"POST",headers:{"authorization":"Bearer "+"x".repeat(45)},
    body:JSON.stringify({order_id:ORDER,checkout_token:"a".repeat(64)})
  });
  await assert.rejects(h.fn("capturePremiumOneTime")(request,{}));
  assert.equal(h.writes.filter(x=>x.op==="premium_one_time_finalize").length,0);
});

// PayPal may put the immutable recipient merchant on the capture instead of
// repeating it on the purchase unit. Either verified field is sufficient,
// but disagreements and missing identities never grant membership.
test("Premium accepts provider-confirmed capture payee when purchase-unit payee is omitted",async()=>{
  const o=providerOrder();delete o.purchase_units[0].payee;
  o.purchase_units[0].payments.captures[0].payee={merchant_id:"MERCHANT12345"};
  const h=harness(o);
  const proof=await h.fn("verifyPremiumOneTimeCapture")({},ORDER,purchase());
  assert.equal(proof.merchant_id,"MERCHANT12345");
});
test("Premium rejects contradictory or absent provider merchant identity",async()=>{
  for(const conflict of [true,false]){
    const o=providerOrder();
    if(conflict){
      o.purchase_units[0].payments.captures[0].payee={merchant_id:"OTHER"};
    }else{
      delete o.purchase_units[0].payee;
    }
    const h=harness(o);
    await assert.rejects(h.fn("verifyPremiumOneTimeCapture")({},ORDER,purchase()));
    assert.equal(h.writes.length,0);
  }
});
test("Premium checkout failure codes preserve member verification and duplicate-order details",async()=>{
  const h=harness();
  const safe=h.fn("premiumCheckoutFailure");
  const forbidden=new Error("ledger_rejected");forbidden.status=403;
  let response=safe(forbidden,"start");
  assert.equal(response.status,403);
  assert.equal((await response.json()).error,"premium_verified_member_required");
  const pending=new Error("ledger_rejected");pending.status=409;
  response=safe(pending,"start");
  assert.equal(response.status,409);
  assert.equal((await response.json()).error,"premium_existing_purchase_review_required");
  const provider=new Error("paypal_request_failed");provider.status=422;
  response=safe(provider,"start");
  assert.equal(response.status,422);
  assert.equal((await response.json()).error,"premium_provider_payment_unavailable");
  response=safe(new Error("internal_secret_value_should_never_escape"),"capture");
  assert.equal((await response.json()).error,"premium_capture_requires_receipt_review");
});
