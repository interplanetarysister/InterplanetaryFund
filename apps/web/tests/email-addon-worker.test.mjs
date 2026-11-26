import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import adapter,{exactPlan,receiveVerifiedEmailWebhook} from "../../../workers/ifund-email-addon-billing/index.mjs";
const base={id:"P-ABCDEFGHIJKLMNOPQRSTUVWX",status:"ACTIVE",product_id:"PROD-ABCDEFGHIJKLMNOP",
  billing_cycles:[{tenure_type:"REGULAR",frequency:{interval_unit:"MONTH",interval_count:1},
    total_cycles:0,pricing_scheme:{fixed_price:{currency_code:"USD",value:"1.00"}}}],
  payment_preferences:{setup_fee:{currency_code:"USD",value:"0.00"}}};
test("PayPal email plan requires precisely $1 USD monthly with no trial or setup fee",()=>{
 assert.equal(exactPlan(base),true);
 const wrong=[
  {...base,billing_cycles:[...base.billing_cycles,{...base.billing_cycles[0]}]},
  {...base,billing_cycles:[{...base.billing_cycles[0],frequency:{interval_unit:"YEAR",interval_count:1}}]},
  {...base,billing_cycles:[{...base.billing_cycles[0],pricing_scheme:{fixed_price:{currency_code:"USD",value:"12.00"}}}]},
  {...base,billing_cycles:[{...base.billing_cycles[0],total_cycles:1}]},
  {...base,payment_preferences:{setup_fee:{currency_code:"USD",value:"5.00"}}},
  {...base,taxes:{percentage:"5.00",inclusive:false}},
  {...base,status:"INACTIVE"}, {...base,id:"browser-chosen-plan"}
 ];
 for(const item of wrong)assert.equal(exactPlan(item),false);
});
test("Guest requests cannot start a PayPal subscription or view private status",async()=>{
 const env={IFUND_SUPABASE_URL:"https://ssibsfmtodgximseeqsv.supabase.co",
 SUPABASE_PUBLISHABLE_KEY:"sb_publishable_test_key_at_least_ten_characters",
 IFUND_EMAIL_ADDON_CHECKOUT_ENABLED:"disabled"};
 for(const [path,method] of [["/api/payments/email-addon/status","GET"],["/api/payments/email-addon/start","POST"]]){
  const response=await adapter.fetch(new Request("https://interplanetaryfund.com"+path,{
   method,...(method==="POST"?{headers:{"content-type":"application/json"},body:JSON.stringify({request_id:crypto.randomUUID()})}:{})
  }),env);
  assert.equal(response.status,401);
  const body=await response.json();assert.equal(body.ok,false);
 }
});
test("Missing backend prevents unchecked PayPal requests",async()=>{
 const response=await adapter.fetch(
   new Request("https://interplanetaryfund.com/api/payments/email-addon/start",{method:"POST"}),
   {IFUND_EMAIL_ADDON_CHECKOUT_ENABLED:"enabled"});
 assert.equal(response.status,503);
});
test("Checkout source requires plan flag, owner RPC and signed provider binding",()=>{
 const worker=readFileSync(new URL("../../../workers/ifund-email-addon-billing/index.mjs",import.meta.url),"utf8");
 const edge=readFileSync(new URL("../../../supabase/functions/ifund-email-addon-ledger/index.ts",import.meta.url),"utf8");
 const router=readFileSync(new URL("../.."+"/../worker/index.js",import.meta.url),"utf8");
 assert.match(worker,/IFUND_EMAIL_ADDON_CHECKOUT_ENABLED/);
 assert.match(worker,/exactPlan\(plan\)/);
 assert.match(worker,/ifund_begin_campaign_email_checkout/);
 assert.match(worker,/signedLedger\(env,"intent_bind"/);
 assert.match(worker,/approval_url:approval/);
 assert.match(worker,/addon_active:false/);
 assert.match(worker,/paypal_provider_unavailable/);
 assert.match(edge,/crypto\.subtle\.verify/);
 assert.match(edge,/provider_evidence_unverified/);
 assert.match(router,/IFUND_EMAIL_ADDON_BILLING\.fetch\(request\)/);
 assert.doesNotMatch(worker,/PAYPAL_CLIENT_SECRET\s*=\s*["'][^"']+/);
});

const emailPlan="P-ABCDEFGHIJKLMNOPQRSTUVWX",sub="I-ABCDEFGHIJKL",sale="SALE1234567890";
const eventRequest=(event,headers={})=>new Request("https://interplanetaryfund.com/api/payments/email-addon/webhook",{
 method:"POST",headers:{"content-type":"application/json","paypal-transmission-id":"synthetic",
 "paypal-transmission-time":"2026-11-26T00:00:00Z","paypal-transmission-sig":"synthetic",
 "paypal-auth-algo":"SHA256withRSA","paypal-cert-url":"https://api.paypal.com/v1/notifications/certs/test",...headers},
 body:JSON.stringify({id:"WH-ABCDEFGH-12345678",create_time:"2026-11-26T00:00:00Z",...event})
});
const eventEnv={IFUND_PAYPAL_MODE:"live",IFUND_EMAIL_ADDON_PLAN_ID:emailPlan,IFUND_EMAIL_ADDON_WEBHOOK_ID:"WEBHOOK1234",
 PAYPAL_CLIENT_ID:"synthetic",PAYPAL_CLIENT_SECRET:"synthetic",IFUND_SUPABASE_URL:"https://ssibsfmtodgximseeqsv.supabase.co",
 SUPABASE_PUBLISHABLE_KEY:"synthetic-public"};
test("verified event for different subscription plan is acknowledged without any billing mutation",async()=>{
 const calls=[];
 const fetcher=async(url,options)=>{
  calls.push(url);
  if(url.endsWith("/v1/oauth2/token"))return Response.json({access_token:"synthetic"});
  if(url.endsWith("/verify-webhook-signature"))return Response.json({verification_status:"SUCCESS"});
  if(url.endsWith("/v1/payments/sale/"+sale))return Response.json({id:sale,billing_agreement_id:sub});
  if(url.endsWith("/v1/billing/subscriptions/"+sub))return Response.json({id:sub,plan_id:"P-OTHERPLANABCDEFGHIJKLMNOP",custom_id:"ordinary-membership"});
  throw Error("Unexpected provider call");
 };
 const r=await receiveVerifiedEmailWebhook(eventRequest({event_type:"PAYMENT.SALE.COMPLETED",resource:{id:sale,billing_agreement_id:sub}}),eventEnv,fetcher);
 assert.equal(r.status,200);assert.equal((await r.json()).ignored,true);
 assert.ok(!calls.some(x=>x.includes("/functions/v1/")));
});
test("refund verifies original sale ID and never substitutes the refund receipt ID",async()=>{
 const calls=[];let ledgerPayload;
 const kp=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
 const jwk=JSON.stringify(await crypto.subtle.exportKey("jwk",kp.privateKey));
 const fetcher=async(url,options)=>{
  calls.push(url);
  if(url.endsWith("/v1/oauth2/token"))return Response.json({access_token:"synthetic"});
  if(url.endsWith("/verify-webhook-signature"))return Response.json({verification_status:"SUCCESS"});
  if(url.endsWith("/v1/payments/sale/"+sale))return Response.json({id:sale,billing_agreement_id:sub,state:"refunded",amount:{currency:"USD",total:"1.00"},payee:{merchant_id:"MERCHANT1234"}});
  if(url.endsWith("/v1/billing/subscriptions/"+sub))return Response.json({id:sub,plan_id:emailPlan,custom_id:"ifund-email-addon:11111111-1111-4111-8111-111111111111"});
  if(url.endsWith("/v1/billing/plans/"+emailPlan))return Response.json(base);
  if(url.endsWith("/functions/v1/ifund-email-addon-ledger")){
   const body=JSON.parse(options.body);
   if(body.op==="plan_identity")return Response.json({ok:true,result:{verified:true,plan_id:emailPlan,merchant_id:"MERCHANT1234"}});
   if(body.op==="event_stage"){ledgerPayload=body.data.p_event;return Response.json({ok:true,result:{accepted:true}});}
   if(body.op==="event_reconcile")return Response.json({ok:true,result:{accepted:true,billing_state:"refunded"}});
  }
  throw Error("Unexpected provider call");
 };
 const r=await receiveVerifiedEmailWebhook(eventRequest({event_type:"PAYMENT.SALE.REFUNDED",resource:{id:"REFUND12345678",sale_id:sale}}),{...eventEnv,IFUND_PAYMENTS_EDGE_SIGNING_PRIVATE_JWK:jwk},fetcher);
 assert.equal(r.status,200);assert.equal(ledgerPayload.resource_id,sale);assert.equal(ledgerPayload.kind,"refund");
 assert.ok(!calls.some(x=>x.endsWith("/REFUND12345678")));
});
test("unverified webhook cannot trigger provider lookup or ledger mutation",async()=>{
 const calls=[];
 const fetcher=async(url)=>{
  calls.push(url);
  if(url.endsWith("/v1/oauth2/token"))return Response.json({access_token:"synthetic"});
  if(url.endsWith("/verify-webhook-signature"))return Response.json({verification_status:"FAILURE"});
  throw Error("Unexpected call");
 };
 const r=await receiveVerifiedEmailWebhook(eventRequest({event_type:"PAYMENT.SALE.COMPLETED",resource:{id:sale}}),eventEnv,fetcher);
 assert.equal(r.status,401);assert.equal(calls.length,2);
});
