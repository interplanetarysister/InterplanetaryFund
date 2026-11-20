import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {checkedEmailAddonStatus,linkCampaignEmail} from "../src/lib/campaignEmailAddon.mjs";
const owner="11111111-1111-4111-8111-111111111111";
const campaign="22222222-2222-4222-8222-222222222222";
const active={
  eligible:true,paid_tier:"basic",basic_addon_amount_cents:100,
  currency:"USD",interval:"monthly",opted_in:true,
  requested_handle:"fundraiser2026",
  requested_address:"fundraiser2026@interplanetaryfund.com",
  linked_campaign_id:null,billing_verified:false,routing_verified:false,
  active:false,state:"awaiting_verified_addon_payment",can_receive_email:false,can_send_email:false
};
test("Email add-on status validates campaign IDs and does not treat reservation as active",()=>{
  assert.equal(checkedEmailAddonStatus(active).active,false);
  assert.throws(()=>checkedEmailAddonStatus({...active,linked_campaign_id:"../admin"}));
});
test("Owner confirmation is required before an email identity is connected to a campaign",async()=>{
  let latest=active,calls=[];
  const client={
    auth:{getUser:async()=>({data:{user:{id:owner,is_anonymous:false,email_confirmed_at:"2026-11-19"}},error:null})},
    rpc:async(name,args)=>{
      calls.push([name,args]);
      if(name==="ifund_set_campaign_email_campaign"){latest={...latest,linked_campaign_id:args.p_campaign_id};return {data:args.p_campaign_id,error:null};}
      return {data:latest,error:null};
    }
  };
  const saved=await linkCampaignEmail(client,{campaignId:campaign});
  assert.equal(saved.linked_campaign_id,campaign);
  assert.deepEqual(calls.map(x=>x[0]),[
    "ifund_campaign_email_addon_status","ifund_set_campaign_email_campaign","ifund_campaign_email_addon_status"
  ]);
  assert.equal(saved.active,false,"linking must never activate unbilled mailbox");
});
test("Invalid or unconfirmed campaign connections fail without claiming success",async()=>{
  await assert.rejects(()=>linkCampaignEmail({}, {campaignId:"invalid"}));
  const client={auth:{getUser:async()=>({data:{user:{id:owner,email_confirmed_at:"2026-11-19"}},error:null})},
    rpc:async name=>({data:name==="ifund_set_campaign_email_campaign"?campaign:active,error:null})};
  await assert.rejects(()=>linkCampaignEmail(client,{campaignId:campaign}),/changed unexpectedly/);
});
test("Service-only delivery enforces payment, recipient ownership, unique receipt, and private inbox",()=>{
 const m=readFileSync(new URL("../../../supabase/migrations/20261119230500_ifund_campaign_email_campaign_link.sql",import.meta.url),"utf8");
 const e=readFileSync(new URL("../../../supabase/functions/ifund-member-mail-ingress/index.ts",import.meta.url),"utf8");
 const w=readFileSync(new URL("../../../workers/ifund-email-ingress/email.mjs",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/components/subscriptions/CampaignEmailAddon.jsx",import.meta.url),"utf8");
 assert.match(m,/grant execute on function public\.ifund_receive_paid_campaign_email\(text,text,text,text,text\)\s+to service_role/);
 assert.match(m,/revoke all on function public\.ifund_receive_paid_campaign_email\(text,text,text,text,text\)/);
 assert.match(m,/b\.amount_cents=100/);
 assert.match(m,/b\.paid_through>now\(\)/);
 assert.match(m,/b\.routing_verified_at is not null/);
 assert.match(m,/e\.valid_until>now\(\)/);
 assert.match(m,/o\.opted_in=true/);
 assert.match(m,/c\.owner_id=o\.owner_id/);
 assert.match(m,/on conflict\(canonical_operation_id\)/);
 assert.match(m,/campaign_id,campaign_title,recipient_address/);
 assert.match(e,/ifund_receive_paid_campaign_email/);
 assert.match(e,/crypto\.subtle\.verify/);
 assert.match(w,/Paid member email routing failed/);
 assert.match(w,/IFUND_MEMBER_EMAIL_RECEIVER_URL/);
 assert.match(w,/interplanetarysister@gmail\.com/);
 assert.match(w,/cuddlemeplatonically@gmail\.com/);
 assert.match(ui,/onSubmit=\{connectCampaign\}/);
 assert.match(ui,/linkedCampaign/);
});
