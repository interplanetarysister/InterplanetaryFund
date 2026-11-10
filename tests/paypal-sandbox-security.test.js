import test from "node:test";
import assert from "node:assert/strict";
import {sandboxConfigured, confirmCapturedOrder, confirmedWebhookResource, SandboxVerificationError,issueCheckoutBinding,requireCheckoutSession,atomicCaptureUpdateFilter,associatedCaptureWebhook} from "../worker/paypalSandboxSecurity.js";
const env = {IFUND_PAYPAL_SANDBOX_ENABLED:"enabled",PAYPAL_CLIENT_ID:"sandbox_id",PAYPAL_CLIENT_SECRET:"secret",PAYPAL_WEBHOOK_ID:"webhook",SUPABASE_URL:"https://example.supabase.co",SUPABASE_SECRET_KEY:"secret"};
const record = {paypal_order_id:"ORDER-12345678",campaign_id:"campaign-one",gift_cents:500,paypal_capture_id:"CAPTURE-12345678"};
const order = {id:record.paypal_order_id,status:"COMPLETED",purchase_units:[{custom_id:record.campaign_id,amount:{currency_code:"USD",value:"5.00"},payments:{captures:[{id:record.paypal_capture_id,status:"COMPLETED",amount:{currency_code:"USD",value:"5.00"}}]}}]};
test("sandbox enablement requires all server-only bindings and HTTPS",()=> {
 assert.equal(sandboxConfigured(env),true);
 for (const name of ["PAYPAL_CLIENT_ID","PAYPAL_CLIENT_SECRET","PAYPAL_WEBHOOK_ID","SUPABASE_URL","SUPABASE_SECRET_KEY"]) assert.equal(sandboxConfigured({...env,[name]:""}),false,name);
 assert.equal(sandboxConfigured({...env,IFUND_PAYPAL_SANDBOX_ENABLED:"disabled"}),false);
 assert.equal(sandboxConfigured({...env,SUPABASE_URL:"http://example.supabase.co"}),false);
});
test("only one matching PayPal-completed capture is accepted",()=> {
 assert.deepEqual(confirmCapturedOrder(order,record),{orderId:record.paypal_order_id,captureId:record.paypal_capture_id,amountCents:500});
 const wrong = [
 {...order,status:"APPROVED"}, {...order,id:"ORDER-OTHER123"},
 {...order,purchase_units:[]},{...order,purchase_units:[...order.purchase_units,...order.purchase_units]},
 {...order,purchase_units:[{...order.purchase_units[0],custom_id:"other"}]},
 {...order,purchase_units:[{...order.purchase_units[0],amount:{currency_code:"USD",value:"6.00"}}]},
 {...order,purchase_units:[{...order.purchase_units[0],payments:{captures:[{...order.purchase_units[0].payments.captures[0],amount:{currency_code:"USD",value:"4.00"}}]}}]},
 {...order,purchase_units:[{...order.purchase_units[0],payments:{captures:[...order.purchase_units[0].payments.captures,...order.purchase_units[0].payments.captures]}}]}
 ];
 for (const candidate of wrong) assert.throws(()=>confirmCapturedOrder(candidate,record),SandboxVerificationError);
});
test("unassociated, unknown and mismatched webhook resources are rejected",()=>{
 const event={id:"EVENT-12345678",event_type:"PAYMENT.CAPTURE.COMPLETED",resource:{id:record.paypal_capture_id,amount:{currency_code:"USD",value:"5.00"}}};
 assert.equal(confirmedWebhookResource(event,record).captureId,record.paypal_capture_id);
 for (const candidate of [
 {...event,event_type:"UNEXPECTED.EVENT"}, {...event,event_type:"PAYMENT.CAPTURE.REFUNDED"}, {...event,resource:{...event.resource,id:"CAPTURE-WRONG123"}},
 {...event,resource:{...event.resource,amount:{currency_code:"USD",value:"9.00"}}}
 ]) assert.throws(()=>confirmedWebhookResource(candidate,record),SandboxVerificationError);
});

test("checkout token is HttpOnly and bound to the origin and PayPal order",async()=>{
 const binding=await issueCheckoutBinding(record.paypal_order_id);
 assert.match(binding.setCookie,/HttpOnly; Secure; SameSite=Lax/);
 assert.match(binding.checkoutTokenHash,/^[a-f0-9]{64}$/);
 const cookie=binding.setCookie.split(";")[0];
 const request=new Request("https://preview.interplanetaryfund-migration.pages.dev/api/paypal/sandbox/capture",{
  method:"POST",headers:{origin:"https://preview.interplanetaryfund-migration.pages.dev",cookie}});
 const bound={...record,checkout_token_hash:binding.checkoutTokenHash};
 assert.equal(await requireCheckoutSession(request,bound),true);
 assert.match(atomicCaptureUpdateFilter(bound),/status=eq.created&paypal_capture_id=is.null$/);
 for(const changed of [
  new Request(request.url,{method:"POST",headers:{origin:"https://untrusted.example",cookie}}),
  new Request(request.url,{method:"POST",headers:{origin:request.headers.get("origin")}}),
  new Request(request.url,{method:"POST",headers:{origin:request.headers.get("origin"),cookie:cookie.replace(/=([0-9a-f])/,(_,x)=>"="+(x==="0"?"1":"0"))}})
 ]) await assert.rejects(requireCheckoutSession(changed,bound),SandboxVerificationError);
 assert.throws(()=>atomicCaptureUpdateFilter(record),SandboxVerificationError);
});
test("webhook must contain the exact associated order and USD amount",()=>{
 const event={event_type:"PAYMENT.CAPTURE.COMPLETED",resource:{
  id:record.paypal_capture_id,amount:{currency_code:"USD",value:"5.00"},
  supplementary_data:{related_ids:{order_id:record.paypal_order_id}}}};
 assert.equal(associatedCaptureWebhook(event,record).captureId,record.paypal_capture_id);
 for(const changed of [
  {...event,resource:{...event.resource,supplementary_data:{related_ids:{order_id:"OTHER-12345678"}}}},
  {...event,resource:{...event.resource,amount:{currency_code:"USD",value:"8.00"}}},
  {...event,event_type:"PAYMENT.CAPTURE.REFUNDED"}
 ])assert.throws(()=>associatedCaptureWebhook(changed,record),SandboxVerificationError);
});
