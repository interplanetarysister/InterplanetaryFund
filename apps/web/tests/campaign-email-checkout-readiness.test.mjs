import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {readEmailAddonCheckoutReadiness} from "../src/lib/campaignEmailAddon.mjs";
const uid="11111111-1111-4111-8111-111111111111";
const unavailable={plan_available:false,subscription_eligible:true,opted_in:true,checkout_ready:false,monthly_amount_cents:100,currency:"USD",payment_provider:"paypal",requires_recurring_provider_checkout:true,approval_alone_activates:false};
const client=(data=unavailable)=>({auth:{getUser:async()=>({data:{user:{id:uid,email_confirmed_at:"2026-11-19T00:00:00Z",is_anonymous:false}},error:null})},rpc:async name=>{assert.equal(name,"ifund_campaign_email_checkout_readiness");return {data,error:null}}});
test("Basic email checkout remains unavailable without a provider verified $1 plan",async()=>{
 const state=await readEmailAddonCheckoutReadiness(client());
 assert.equal(state.checkout_ready,false);
 assert.equal(state.monthly_amount_cents,100);
});
test("Never trust a contradictory or forged plan status",async()=>{
 const forged=[{...unavailable,checkout_ready:true},{...unavailable,monthly_amount_cents:0},{...unavailable,payment_provider:"other"},{...unavailable,approval_alone_activates:true},{...unavailable,requires_recurring_provider_checkout:false}];
 for(const status of forged)await assert.rejects(()=>readEmailAddonCheckoutReadiness(client(status)));
});
test("Checkout verification is member-only",async()=>{
 const guest={auth:{getUser:async()=>({data:{user:null},error:null})}};
 await assert.rejects(()=>readEmailAddonCheckoutReadiness(guest),/verified account/);
});
test("Live plan credentials and ready state must be set by the provider trusted server",()=>{
 const migration=readFileSync(new URL("../../../supabase/migrations/20261119232500_ifund_campaign_email_paypal_plan_readiness.sql",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/components/subscriptions/CampaignEmailAddon.jsx",import.meta.url),"utf8");
 assert.match(migration,/amount_cents=100/);
 assert.match(migration,/v_plan\.webhook_verified_at<=now\(\)/);
 assert.match(migration,/v_plan\.merchant_id/);
 assert.match(migration,/v_addon->>'paid_tier'='basic'/);
 assert.match(migration,/revoke all on function public\.ifund_campaign_email_checkout_readiness\(\)/);
 assert.match(ui,/readEmailAddonCheckoutReadiness\(authClient\(\)\)/);
 assert.match(ui,/checkout is not yet available/i);
 assert.doesNotMatch(ui,/onClick=\{.*?payForAddon/);
});
