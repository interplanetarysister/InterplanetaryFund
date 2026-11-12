import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";

const source=readFileSync(new URL("../../../workers/ifund-payments/worker.js",import.meta.url),"utf8")
  .replace("export default {","globalThis.__worker = {");
const campaignId="a48d705e-2118-4464-b97d-605e116d91d2";
const requestKey="0123456789ABCDEF0123456789ABCDEF";
const token="ab".repeat(32), orderId="5O190127TN364715T";

async function harness(enabled=true) {
  const key=await webcrypto.subtle.generateKey(
    {name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
  const jwk=await webcrypto.subtle.exportKey("jwk",key.privateKey);
  const events=[],intents=new Map(),beginData=[];
  let created=0;
  const sandbox={crypto:webcrypto,TextEncoder,URL,Response,Request,atob,btoa,console};
  sandbox.fetch=async (url,opts={})=>{
    const path=String(url);
    if(path.endsWith("/functions/v1/ifund-payment-ledger")){
      const {op,data}=JSON.parse(opts.body);events.push(op);
      if(op==="begin"){
        beginData.push(data);
        const existing=intents.get(data.request_key);
        if(existing){
          const valid=["campaign_id","gift_cents","optional_support_cents",
            "total_cents","payment_channel","checkout_token_hash"].every(k=>existing[k]===data[k]);
          return valid?Response.json({ok:true,status:existing.status,order_id:existing.order_id||null}):
            Response.json({ok:false,error:"conflict"},{status:409});
        }
        intents.set(data.request_key,{...data,status:"creating",order_id:null});
        return Response.json({ok:true,status:"creating",order_id:null});
      }
      if(op==="bind"){
        const intent=intents.get(data.request_key);
        if(!intent)return Response.json({ok:false},{status:409});
        intent.order_id=data.paypal_order_id;intent.status="created";
        return Response.json({ok:true});
      }
      throw Error("Unexpected ledger operation "+op);
    }
    if(path.endsWith("/v1/oauth2/token"))
      return Response.json({access_token:"mock-access-token"});
    if(path.endsWith("/v2/checkout/orders")&&opts.method==="POST"){
      created++;
      return Response.json({id:orderId,status:"CREATED"});
    }
    throw Error("Unexpected URL "+path);
  };
  vm.runInNewContext(source,sandbox,{filename:"worker.js"});
  const env={IFUND_PAYMENTS_ENABLED:String(enabled),IFUND_PAYPAL_MODE:"live",
    IFUND_ALLOWED_ORIGINS:"https://interplanetaryfund.com",
    IFUND_SUPABASE_URL:"https://db.test",
    IFUND_PAYMENTS_EDGE_SIGNING_PRIVATE_JWK:JSON.stringify(jwk),
    PAYPAL_CLIENT_ID:"mock-id",PAYPAL_CLIENT_SECRET:"mock-secret"};
  return {
    async create(checkoutToken=token,request_key=requestKey,donorToken=null){
      const body={campaign_id:campaignId,gift_cents:100,optional_support_cents:0,
        payment_channel:"paypal",request_key,checkout_token:checkoutToken};
      const req=new Request("https://interplanetaryfund.com/api/payments/create-order",
        {method:"POST",headers:{origin:"https://interplanetaryfund.com",
          "content-type":"application/json",...(donorToken===null?{}:{authorization:donorToken})},body:JSON.stringify(body)});
      const res=await sandbox.__worker.fetch(req,env);
      return {status:res.status,data:await res.json()};
    },
    events,orders:()=>created,intents,beginData
  };
}

test("one PayPal order is created for repeated authorized checkout requests",async()=>{
  const h=await harness();
  const first=await h.create();
  const second=await h.create();
  assert.equal(first.status,200);
  assert.equal(second.status,200);
  assert.equal(first.data.id,orderId);
  assert.equal(second.data.id,orderId);
  assert.equal(first.data.checkout_token,token);
  assert.equal(second.data.checkout_token,token);
  assert.equal(h.orders(),1);
  assert.deepEqual(h.events,["begin","bind","begin"]);
});

test("different token for same request key cannot mint another provider order",async()=>{
  const h=await harness();
  assert.equal((await h.create()).status,200);
  const attempt=await h.create("cd".repeat(32));
  assert.notEqual(attempt.status,200);
  assert.equal(h.orders(),1);
  assert.deepEqual(h.events,["begin","bind","begin"]);
});

test("malformed client token is rejected before ledger or provider access",async()=>{
  const h=await harness();
  const attempt=await h.create("not-a-cryptographic-token");
  assert.equal(attempt.status,400);
  assert.equal(h.orders(),0);
  assert.deepEqual(h.events,[]);
});

test("payment switch remains authoritative even with a valid client token",async()=>{
  const h=await harness(false);
  const attempt=await h.create();
  assert.equal(attempt.status,503);
  assert.equal(h.orders(),0);
  assert.deepEqual(h.events,[]);
});

test("browser checkout submits the same proof on idempotent retries",()=>{
  const frontend=readFileSync(
    new URL("../src/components/payments/CampaignDonationDialog.jsx",import.meta.url),"utf8");
  assert.match(frontend,/checkoutTokens\.current\.get\(key\)/);
  assert.match(frontend,/request_key:key,checkout_token:checkoutToken/);
  assert.match(frontend,/data\.checkout_token!==checkoutToken/);
});

test("authenticated donor bearer propagates solely into signed payment intent request",async()=>{
  const h=await harness();
  const bearer="Bearer "+"eyJ"+".JWT_SESSION_TOKEN".repeat(8);
  const result=await h.create(token,requestKey,bearer);
  assert.equal(result.status,200);
  assert.equal(h.beginData.length,1);
  assert.equal(h.beginData[0].donor_access_token,bearer.slice(7));
  assert.equal(h.orders(),1);
});
test("guest checkout carries no donor account identity",async()=>{
  const h=await harness();
  const result=await h.create();
  assert.equal(result.status,200);
  assert.equal(h.beginData[0].donor_access_token,null);
});
test("malformed donor session cannot create intent or provider order",async()=>{
  const h=await harness();
  const result=await h.create(token,requestKey,"Bearer invalid");
  assert.equal(result.status,401);
  assert.equal(h.orders(),0);
  assert.deepEqual(h.events,[]);
});
