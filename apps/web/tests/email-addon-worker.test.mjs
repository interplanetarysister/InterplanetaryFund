import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import adapter,{exactPlan} from "../../../workers/ifund-email-addon-billing/index.mjs";
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
