// Saved payment methods (PayPal Vault v3) — synthetic harness.
// Never calls PayPal or stores a card number: provider and ledger are stubbed.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";

const code=readFileSync(new URL("./worker.js",import.meta.url),"utf8");
const METHOD_ID="11111111-1111-4111-8111-111111111111";
const PAYMENT_TOKEN="PAYTOK123456";
const SETUP_TOKEN="SETUPTOK123456";
const descriptor=()=>({id:METHOD_ID,brand:"VISA",last4:"4242",expiry_month:3,
  expiry_year:2028,cardholder_name:"Test User",is_default:true,status:"active",
  created_at:"2026-11-27T00:00:00Z"});
const vaultedCard=()=>({id:PAYMENT_TOKEN,customer:{id:"CUST12345"},
  payment_source:{card:{brand:"VISA",last_digits:"4242",expiry:"2028-03",name:"Test User"}}});
const ENV={IFUND_PAYMENTS_ENABLED:"true",IFUND_PAYPAL_MODE:"live",
  IFUND_ALLOWED_ORIGINS:"https://interplanetaryfund.com"};
const AUTH="Bearer "+"x".repeat(45);

function harness(vault=vaultedCard()){
  const requests=[],writes=[];
  const context=vm.createContext({
    Response,Request,URL,TextEncoder,TextDecoder,crypto:globalThis.crypto,
    btoa,atob,Date,console
  });
  vm.runInContext(code.replace("export default {","globalThis.__worker = {"),context);
  context.__paypal=async(_env,path,method="GET",body)=>{
    requests.push({path,method,body});
    if(method==="POST"&&path==="/v3/vault/setup-tokens")return {id:SETUP_TOKEN,status:"PAYER_ACTION_REQUIRED"};
    if(method==="POST"&&path==="/v3/vault/payment-tokens")return vault;
    if(method==="DELETE"&&path.startsWith("/v3/vault/payment-tokens/"))return {};
    throw Error("Provider call not stubbed: "+method+" "+path);
  };
  context.__ledger=async(_env,op,payload)=>{
    writes.push({op,payload});
    if(op==="saved_method_list")return {ok:true,methods:[descriptor()]};
    if(op==="saved_method_record")return {ok:true,method:descriptor()};
    if(op==="saved_method_delete")return {ok:true,removed:true,payment_token_id:PAYMENT_TOKEN};
    if(op==="saved_method_set_default")return {ok:true,method:descriptor()};
    throw Error("Unexpected broker op "+op);
  };
  vm.runInContext("paypal=__paypal;signLedger=__ledger;",context);
  return {worker:context.__worker,requests,writes};
}
function request(path,{method="GET",auth=true,origin="https://interplanetaryfund.com",body}={}){
  const headers={"content-type":"application/json"};
  if(origin)headers.origin=origin;
  if(auth)headers.authorization=AUTH;
  return new Request("https://interplanetaryfund.com"+path,{method,headers,
    body:body===undefined?undefined:JSON.stringify(body)});
}

test("Saved-method routes are closed while payments are disabled",async()=>{
  const h=harness();
  const res=await h.worker.fetch(request("/api/payments/saved-methods"),{});
  assert.equal(res.status,503);
  assert.equal((await res.json()).error,"payments_disabled");
  assert.equal(h.requests.length,0);
  assert.equal(h.writes.length,0);
});
test("Saved-method POSTs reject unlisted origins",async()=>{
  const h=harness();
  const res=await h.worker.fetch(request("/api/payments/saved-methods/setup-token",
    {method:"POST",origin:"https://evil.example",body:{}}),ENV);
  assert.equal(res.status,403);
  assert.equal((await res.json()).error,"origin_not_allowed");
  assert.equal(h.requests.length,0);
});
test("Saved-method routes require a member session",async()=>{
  const h=harness();
  const res=await h.worker.fetch(request("/api/payments/saved-methods",{auth:false}),ENV);
  assert.equal(res.status,401);
  assert.equal((await res.json()).error,"sign_in_required");
  assert.equal(h.writes.length,0);
});
test("Setup token verifies the member first, then asks PayPal to create it",async()=>{
  const h=harness();
  const res=await h.worker.fetch(request("/api/payments/saved-methods/setup-token",{method:"POST",body:{}}),ENV);
  assert.equal(res.status,200);
  const body=await res.json();
  assert.equal(body.setup_token_id,SETUP_TOKEN);
  assert.deepEqual(h.writes.map(x=>x.op),["saved_method_list"]);
  assert.equal(h.writes[0].payload.member_access_token,AUTH.slice(7));
  assert.deepEqual(h.requests.map(x=>x.path),["/v3/vault/setup-tokens"]);
  // The setup-token request must never carry card data.
  assert.equal(JSON.stringify(h.requests[0].body).includes("4242"),false);
});
test("Exchange maps the verified vault response into a descriptor-only record",async()=>{
  const h=harness();
  const res=await h.worker.fetch(request("/api/payments/saved-methods/exchange",
    {method:"POST",body:{setup_token_id:SETUP_TOKEN}}),ENV);
  assert.equal(res.status,200);
  const text=await res.text();
  const body=JSON.parse(text);
  assert.equal(body.method.brand,"VISA");
  assert.equal(body.method.last4,"4242");
  // The reusable payment token and PayPal customer id never reach the browser.
  assert.equal(text.includes(PAYMENT_TOKEN),false);
  assert.equal(text.includes("CUST12345"),false);
  assert.deepEqual(h.requests.map(x=>x.path),["/v3/vault/payment-tokens"]);
  assert.equal(JSON.stringify(h.requests[0].body),
    JSON.stringify({payment_source:{token:{id:SETUP_TOKEN,type:"SETUP_TOKEN"}}}));
  assert.deepEqual(h.writes.map(x=>x.op),["saved_method_record"]);
  const record=h.writes[0].payload;
  assert.equal(record.payment_token_id,PAYMENT_TOKEN);
  assert.equal(record.paypal_customer_id,"CUST12345");
  assert.equal(record.brand,"VISA");
  assert.equal(record.last4,"4242");
  assert.equal(record.expiry_month,3);
  assert.equal(record.expiry_year,2028);
  assert.equal(record.cardholder_name,"Test User");
});
test("Exchange refuses an unverifiable vault response and records nothing",async()=>{
  const broken=vaultedCard();delete broken.payment_source.card.last_digits;
  const h=harness(broken);
  const res=await h.worker.fetch(request("/api/payments/saved-methods/exchange",
    {method:"POST",body:{setup_token_id:SETUP_TOKEN}}),ENV);
  assert.equal(res.status,502);
  assert.equal((await res.json()).error,"vault_exchange_unverified");
  assert.equal(h.writes.filter(x=>x.op==="saved_method_record").length,0);
});
test("Exchange rejects a malformed setup token before calling PayPal",async()=>{
  const h=harness();
  const res=await h.worker.fetch(request("/api/payments/saved-methods/exchange",
    {method:"POST",body:{setup_token_id:"bad token!"}}),ENV);
  assert.equal(res.status,400);
  assert.equal((await res.json()).error,"invalid_setup_token");
  assert.equal(h.requests.length,0);
});
test("List returns descriptors only",async()=>{
  const h=harness();
  const res=await h.worker.fetch(request("/api/payments/saved-methods"),ENV);
  assert.equal(res.status,200);
  const text=await res.text();
  assert.equal(JSON.parse(text).methods.length,1);
  assert.equal(text.includes("payment_token_id"),false);
  assert.equal(text.includes(PAYMENT_TOKEN),false);
});
test("Delete removes the ledger record first, then deletes the PayPal token",async()=>{
  const h=harness();
  const res=await h.worker.fetch(request("/api/payments/saved-methods/delete",
    {method:"POST",body:{saved_method_id:METHOD_ID}}),ENV);
  assert.equal(res.status,200);
  const text=await res.text();
  assert.equal(JSON.parse(text).removed,true);
  assert.equal(text.includes(PAYMENT_TOKEN),false);
  assert.deepEqual(h.writes.map(x=>x.op),["saved_method_delete"]);
  assert.deepEqual(h.requests.map(x=>x.method+" "+x.path),
    ["DELETE /v3/vault/payment-tokens/"+PAYMENT_TOKEN]);
});
test("Set default records through the ledger and returns the descriptor",async()=>{
  const h=harness();
  const res=await h.worker.fetch(request("/api/payments/saved-methods/default",
    {method:"POST",body:{saved_method_id:METHOD_ID}}),ENV);
  assert.equal(res.status,200);
  assert.equal((await res.json()).method.is_default,true);
  assert.deepEqual(h.writes.map(x=>x.op),["saved_method_set_default"]);
  assert.equal(h.writes[0].payload.saved_method_id,METHOD_ID);
});
test("Delete and default reject malformed method references",async()=>{
  const h=harness();
  for(const path of ["/api/payments/saved-methods/delete","/api/payments/saved-methods/default"]){
    const res=await h.worker.fetch(request(path,{method:"POST",body:{saved_method_id:"not-a-uuid"}}),ENV);
    assert.equal(res.status,400);
    assert.equal((await res.json()).error,"invalid_saved_method_reference");
  }
  assert.equal(h.writes.length,0);
});
