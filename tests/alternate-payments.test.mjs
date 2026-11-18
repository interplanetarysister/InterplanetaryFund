import test from "node:test";
import assert from "node:assert/strict";
import { handleAlternatePayments } from "../workers/ifund-payments/alternateCheckout.mjs";
import { readFileSync } from "node:fs";
const worker=readFileSync(new URL("../workers/ifund-payments/worker.js",import.meta.url),"utf8");
const ui=readFileSync(new URL("../apps/web/src/components/payments/AlternativeDonationOptions.jsx",import.meta.url),"utf8");
const dialog=readFileSync(new URL("../apps/web/src/components/payments/CampaignDonationDialog.jsx",import.meta.url),"utf8");
const campaign="11111111-1111-4111-8111-111111111111";
const nonce="a".repeat(64);
const request=(path,method="GET",data,headers={})=>new Request("https://interplanetaryfund.com"+path,{
  method,headers:{"origin":"https://interplanetaryfund.com",...headers},
  ...data===undefined?{}:{body:JSON.stringify(data)}
});
const env={IFUND_ALLOWED_ORIGINS:"https://interplanetaryfund.com"};
const read=async response=>({status:response.status,body:await response.json()});
test("alternative routes independent of PayPal launch flag",()=>{
  assert.match(worker,/handleAlternatePayments\(request,env\)/);
  assert.ok(worker.indexOf('if(path.startsWith("/api/payments/alternatives/"))')<
    worker.indexOf('if(env.IFUND_PAYMENTS_ENABLED!=="true"||env.IFUND_PAYPAL_MODE!=="live")'));
});
test("no live provider keys or approved ledger => no visible payment choices",async()=>{
  const x=await read(await handleAlternatePayments(request("/api/payments/alternatives/config"),env));
  assert.equal(x.status,200);assert.equal(x.body.wallet_enabled,false);assert.equal(x.body.crypto_enabled,false);
});
test("cannot create wallet checkout while atomic ledger is unavailable",async()=>{
  const x=await read(await handleAlternatePayments(request("/api/payments/alternatives/create-session","POST",{
    channel:"wallet",campaign_id:campaign,request_key:nonce,gift_cents:2500,optional_support_cents:0
  }),env));
  assert.equal(x.status,503);assert.equal(x.body.ok,false);
});
test("cannot create crypto checkout without merchant crypto clearance",async()=>{
  const x=await read(await handleAlternatePayments(request("/api/payments/alternatives/create-session","POST",{
    channel:"crypto",campaign_id:campaign,request_key:nonce,gift_cents:2500,optional_support_cents:0
  }),{...env,IFUND_ALTERNATE_PAYMENTS_ENABLED:"true",IFUND_ALTERNATE_LEDGER_CONTRACT:"accepted-v1",
    IFUND_ALTERNATE_LEDGER:{fetch:()=>{throw Error("must not be called")}},IFUND_STRIPE_MODE:"live"}));
  assert.equal(x.status,503);
});
test("cross-origin payment start rejected before provider access",async()=>{
  const req=request("/api/payments/alternatives/create-session","POST",{
    channel:"wallet",campaign_id:campaign,request_key:nonce,gift_cents:2500,optional_support_cents:0
  },{"origin":"https://evil.example"});
  const x=await read(await handleAlternatePayments(req,env));
  assert.equal(x.status,403);
});
test("webhook without signed Stripe header rejected in configured synthetic service",async()=>{
  const cfg={...env,IFUND_ALTERNATE_PAYMENTS_ENABLED:"true",IFUND_ALTERNATE_LEDGER_CONTRACT:"accepted-v1",
    IFUND_ALTERNATE_LEDGER:{fetch:()=>{throw Error("unsigned webhook touched ledger")}},
    IFUND_STRIPE_MODE:"live"};
  const req=request("/api/payments/alternatives/webhook","POST",{id:"evt_123456789012",
    type:"checkout.session.completed",livemode:true});
  const x=await read(await handleAlternatePayments(req,cfg));
  assert.equal(x.status,401);assert.equal(x.body.error,"unsigned_webhook");
});
test("invalid amount and unsupported channel rejected before Stripe API call",async()=>{
  const cfg={...env,IFUND_ALTERNATE_PAYMENTS_ENABLED:"true",IFUND_ALTERNATE_LEDGER_CONTRACT:"accepted-v1",
    IFUND_ALTERNATE_LEDGER:{fetch:()=>{throw Error("invalid input touched ledger")}},
    IFUND_STRIPE_MODE:"live"};
  for(const input of [
    {channel:"wallet",gift_cents:99,optional_support_cents:0},
    {channel:"wallet",gift_cents:2500,optional_support_cents:1000},
    {channel:"bank",gift_cents:2500,optional_support_cents:0}
  ]) {
    const x=await read(await handleAlternatePayments(request("/api/payments/alternatives/create-session","POST",{
      campaign_id:campaign,request_key:nonce,...input
    }),cfg));
    assert.ok([400,503].includes(x.status));
  }
});
test("UI allows only server-ready provider, no redirect-as-capture, native remains gated",()=>{
  assert.match(ui,/config\?\.environment === "live"/);
  assert.match(ui,/config\.wallet_enabled === true/);
  assert.match(ui,/config\.crypto_enabled === true/);
  assert.match(ui,/A donation appears in My Giving only after verified provider settlement/);
  assert.match(ui,/window\.location\.assign/);
  assert.match(dialog,/if \(nativeCheckoutUnavailable\) return/);
  assert.match(dialog,/AlternativeDonationOptions/);
});
