import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {planCampaignBudget,moneyToCents} from "../src/lib/budgetPlanning.mjs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");

test("POLARIS integer-cent budget planner includes withdrawal fee without claiming available funds",()=>{
 const plan=planCampaignBudget([{label:"Rent",amount:"100.00"},{label:"Supplies",amount:"25.50"}]);
 assert.equal(plan.ready,true);
 assert.equal(plan.targetCents,12550);
 assert.ok(plan.suggestedGrossCents-plan.platformFeeEstimateCents>=12550);
 assert.match(plan.disclaimer,/processor fees/);
 assert.equal(moneyToCents("0.01"),1);
 assert.equal(moneyToCents("1e2"),null);
});
test("POLARIS budget planner fails closed on invalid or oversize amounts",()=>{
 for(const value of ["-1","3.141","NaN","Infinity","99999999999999999999",null]) {
   assert.equal(planCampaignBudget([{label:"Test",amount:value}]).ready,false);
 }
 assert.equal(planCampaignBudget([{label:"Test",amount:"0"}]).ready,false);
});
test("ECHO custom templates require owner RPC authorization and never trigger external delivery",()=>{
 const sql=read("../../../supabase/migrations/20261113_ifund_echo_private_templates.sql");
 const ui=read("../src/components/agents/EchoSavedTemplates.jsx");
 const workspace=read("../src/pages/CommunicationsWorkspace.jsx");
 assert.match(sql,/revoke all on public\.ifund_communications_templates from public,anon,authenticated/);
 assert.match(sql,/email_confirmed_at is not null and u\.is_anonymous is false/);
 assert.match(sql,/t\.owner_id=v_owner/);
 assert.match(sql,/revoke all on function public\.ifund_save_message_template\(text,text\) from public,anon/);
 assert.match(ui,/rpc\("ifund_save_message_template"/);
 assert.match(ui,/rpc\("ifund_delete_message_template"/);
 assert.match(workspace,/<EchoSavedTemplates message=\{message\} onApply=\{setMessage\}\/>/);
 assert.doesNotMatch(sql,/send_email|http_post|email_provider|deliver_message/i);
});
test("PULSE requires applicant self-verification and does not claim provider eligibility",()=>{
 const page=read("../src/components/agents/OpportunityEligibilityReview.jsx");
 const inst=read("../src/pages/Institutions.jsx");
 assert.match(page,/Only the provider can confirm qualification/);
 assert.match(page,/application window/);
 assert.match(page,/checked\[key\]/);
 assert.match(inst,/<OpportunityEligibilityReview opportunity=\{opportunity\}\/>/);
});
