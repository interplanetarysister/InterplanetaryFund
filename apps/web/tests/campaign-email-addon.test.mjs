import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {BASIC_EMAIL_ADDON_MONTHLY_CENTS,IFUND_EMAIL_DOMAIN,normalizedEmailHandle,checkedEmailAddonStatus,readEmailAddon,selectEmailAddon} from "../src/lib/campaignEmailAddon.mjs";
const ACTIVE={
 eligible:true,paid_tier:"basic",basic_addon_amount_cents:100,currency:"USD",
 interval:"monthly",opted_in:true,requested_handle:"campaign.contact",
 requested_address:"campaign.contact@interplanetaryfund.com",billing_verified:true,
 routing_verified:true,active:true,state:"active",can_receive_email:true,can_send_email:false
};
const INACTIVE={...ACTIVE,active:false,billing_verified:false,routing_verified:false,can_receive_email:false,state:"awaiting_verified_addon_payment"};
const uid="11111111-1111-4111-8111-111111111111";
function fake({status=INACTIVE,invalidUser=false,writeState=null}={}){
 let called=[],saved=writeState||status;
 return {client:{
  auth:{async getUser(){return {data:{user:invalidUser?null:{id:uid,email_confirmed_at:"2026-11-19T00:00:00Z",is_anonymous:false}},error:null}}},
  async rpc(name,args){called.push([name,args]);return {
   data:name==="ifund_set_campaign_email_option"?saved:status,error:null
  }}
 },calls:()=>called};
}
test("pricing, handle validation and domain are explicit",()=>{
 assert.equal(BASIC_EMAIL_ADDON_MONTHLY_CENTS,100);
 assert.equal(IFUND_EMAIL_DOMAIN,"interplanetaryfund.com");
 assert.equal(normalizedEmailHandle("  My.Campaign-2026  "),"my.campaign-2026");
 for(const value of ["a","a".repeat(25),".account","account..name","accounts@other.com","9start","a/../b"])
   assert.throws(()=>normalizedEmailHandle(value));
});
test("client refuses fake active status or self-sending capability",()=>{
 assert.equal(checkedEmailAddonStatus(INACTIVE).active,false);
 assert.throws(()=>checkedEmailAddonStatus({...INACTIVE,active:true}));
 assert.throws(()=>checkedEmailAddonStatus({...ACTIVE,can_send_email:true}));
 assert.throws(()=>checkedEmailAddonStatus({...INACTIVE,requested_address:"attack@example.com"}));
});
test("status and request read through verified member Supabase RPC, not browser flags",async()=>{
 const {client,calls}=fake();
 const result=await readEmailAddon(client);
 assert.equal(result.state,"awaiting_verified_addon_payment");
 assert.deepEqual(calls().map(x=>x[0]),["ifund_campaign_email_addon_status"]);
});
test("guests cannot read or request email identities",async()=>{
 const {client}=fake({invalidUser:true});
 await assert.rejects(()=>readEmailAddon(client),/verified member/);
 await assert.rejects(()=>selectEmailAddon(client,{optIn:true,handle:"campaign.contact"}),/verified member/);
});
test("request must be confirmed against a fresh status and cannot be self-activated",async()=>{
 const {client}=fake({status:INACTIVE,writeState:INACTIVE});
 const result=await selectEmailAddon(client,{optIn:true,handle:"campaign.contact"});
 assert.equal(result.active,false);
 const other=fake({status:{...INACTIVE,opted_in:false}});
 await assert.rejects(()=>selectEmailAddon(other.client,{optIn:true,handle:"campaign.contact"}),/could not be confirmed/);
});
test("database gate never equates a checkbox or admin entitlement with a paid add-on",()=>{
 const sql=readFileSync(new URL("../../../supabase/migrations/20261119213000_ifund_paid_campaign_email_addon.sql",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/components/subscriptions/CampaignEmailAddon.jsx",import.meta.url),"utf8");
 const subs=readFileSync(new URL("../src/pages/Subscriptions.jsx",import.meta.url),"utf8");
 assert.match(sql,/e\.status='active'/);
 assert.match(sql,/e\.provider='paypal'/);
 assert.match(sql,/e\.valid_until>now\(\)/);
 assert.match(sql,/v_bill\.amount_cents=100/);
 assert.match(sql,/v_bill\.paid_through>now\(\)/);
 assert.match(sql,/v_bill\.routing_verified_at is not null/);
 const nullFix=readFileSync(new URL("../../../supabase/migrations/20261119214500_ifund_campaign_email_null_billing_guard.sql",import.meta.url),"utf8");
 assert.match(nullFix,/v_verified:=coalesce\(/);
 assert.match(nullFix,/v_ready:=coalesce\(/);
 assert.match(sql,/is_anonymous is false/);
 assert.match(sql,/revoke all on ifund_ops\.campaign_email_addon_billing from public,anon,authenticated/);
 assert.match(ui,/type="checkbox"/);
 assert.match(ui,/\+\$1\/month/);
 assert.match(ui,/awaiting_verified_addon_payment/);
 assert.match(subs,/<CampaignEmailAddon \/>/);
 assert.doesNotMatch(ui,/paypal\.com\/checkout|subscription_approved:true|mailbox_active:true/);
});
