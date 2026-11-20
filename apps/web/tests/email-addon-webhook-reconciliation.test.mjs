import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import worker from "../../../workers/ifund-email-addon-billing/index.mjs";
const migration=(name)=>readFileSync(new URL("../../../supabase/migrations/"+name,import.meta.url),"utf8");
test("incoming webhook fails closed without a separate verified PayPal webhook identity",async()=>{
 const response=await worker.fetch(new Request("https://interplanetaryfund.com/api/payments/email-addon/webhook",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({id:"WH-ABCD123456789",event_type:"PAYMENT.SALE.COMPLETED"})
 }),{IFUND_PAYPAL_MODE:"live",IFUND_EMAIL_ADDON_PLAN_ID:"P-ABCDEFGHIJKLMNOPQRSTUVWX"});
 assert.equal(response.status,503);
 assert.equal((await response.json()).error,"email_provider_webhook_not_configured");
});
test("webhook implementation checks PayPal signature, merchant, sale, plan and subscription before billing",()=>{
 const src=readFileSync(new URL("../../../workers/ifund-email-addon-billing/index.mjs",import.meta.url),"utf8");
 const router=readFileSync(new URL("../../../worker/index.js",import.meta.url),"utf8");
 const verified=src.indexOf('"verification_status"!=="SUCCESS"');
 // The expression uses optional member access and must reject any signature
 // verification result other than SUCCESS before it stages payment evidence.
 assert.match(src,/verification\?\.verification_status!=="SUCCESS"/);
 assert.match(src,/verify-webhook-signature/);
 assert.match(src,/paypal-transmission-sig/);
 assert.match(src,/paypal-transmission-time/);
 assert.match(src,/PAYPAL_EMAIL_ADDON_WEBHOOK_ID|IFUND_EMAIL_ADDON_WEBHOOK_ID/);
 assert.match(src,/sale\.billing_agreement_id!==subscriptionId/);
 assert.match(src,/sale\?\.payee\?\.merchant_id!==registered\.merchant_id/);
 assert.match(src,/sale\?\.amount\?\.total!=="1\.00"/);
 assert.match(src,/subscription\.plan_id!==env\.IFUND_EMAIL_ADDON_PLAN_ID/);
 assert.match(src,/subscription\.status!=="ACTIVE"/);
 assert.match(src,/signedLedger\(env,"event_stage"/);
 assert.match(src,/signedLedger\(env,"event_reconcile"/);
 assert.match(router,/pathname === '\/api\/payments\/email-addon\/webhook'/);
 assert.doesNotMatch(src,/mailbox_activated:true/);
});
test("service-only reconciliation rejects unverified events, stale periods and browser activation",()=>{
 const reconciliation=migration("20261120005500_ifund_email_provider_event_reconciliation.sql");
 const receiver=migration("20261120010500_ifund_paid_email_receiver_shared_entitlement.sql");
 const resolver=migration("20261120004500_ifund_paid_email_inbound_entitlement_gate.sql");
 const plan=migration("20261120011500_ifund_email_provider_webhook_plan_identity.sql");
 const edge=readFileSync(new URL("../../../supabase/functions/ifund-email-addon-ledger/index.ts",import.meta.url),"utf8");
 assert.match(reconciliation,/current_user<>'service_role'/);
 assert.match(reconciliation,/v_event\.reconciled_at is not null/);
 assert.match(reconciliation,/v_event\.kind='payment'/);
 assert.match(reconciliation,/p_provider_paid_through>v_now\+interval '35 days'/);
 assert.match(reconciliation,/v_event\.provider_event_at<v_now-interval '35 days'/);
 assert.match(reconciliation,/v_status:='active'/);
 assert.match(reconciliation,/routing_verified_at=null/);
 assert.match(reconciliation,/mailbox_activated',false/);
 assert.match(receiver,/public\.ifund_paid_campaign_email_inbound_recipient\(v_to\)/);
 assert.match(resolver,/b\.paid_through>now\(\)/);
 assert.match(resolver,/plan\.webhook_verified_at<=now\(\)/);
 assert.match(plan,/current_user<>'service_role'/);
 assert.match(edge,/"plan_identity","event_reconcile"/);
 assert.match(edge,/ifund_reconcile_campaign_email_provider_event/);
});
