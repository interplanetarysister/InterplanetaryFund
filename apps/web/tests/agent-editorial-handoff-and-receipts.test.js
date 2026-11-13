import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nexusCampaignPriorities } from "../src/lib/nexusTriage.mjs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
test("NEXUS ranks unresolved verified editorial tasks ahead of lower-priority campaign checks",()=>{
 const owned=[{campaign_id:"a",campaign_title:"Community",campaign_status:"draft",verified_captures:0,active_followers:0}];
 const tasks=[{campaign_id:"a",review_status:"owner_action_needed"}];
 const pending=nexusCampaignPriorities(owned,[],tasks);
 assert.equal(pending[0].priority,0);
 assert.equal(pending[0].path,"/agents");
 assert.match(pending[0].why,/not proof of an agent rewrite/);
 const done=nexusCampaignPriorities(owned,[],[{campaign_id:"a",review_status:"acknowledged"}]);
 assert.equal(done[0].priority,1);
});
test("POLARIS provides per-campaign writing advice with target-field links",()=>{
 const page=read("../src/pages/CampaignStrategy.jsx");
 const editor=read("../src/pages/EditCampaign.jsx");
 assert.match(page,/reviewCampaignWideEditorial/);
 assert.match(page,/Contextual campaign writing guidance/);
 assert.match(page,/Open the relevant campaign field/);
 assert.match(page,/fieldId\(finding\)/);
 assert.match(editor,/useLocation\(\)/);
 assert.match(editor,/field\.focus\(\{ preventScroll: true \}\)/);
});
test("ECHO reporting counts only recorded in-app notifications and marked-read flags",()=>{
 const sql=read("../../../supabase/migrations/20261113_ifund_echo_inapp_read_receipts.sql");
 const page=read("../src/components/agents/EchoApprovedMessaging.jsx");
 assert.match(sql,/where d\.owner_id=v_owner/);
 assert.match(sql,/n\.type='announcement'/);
 assert.match(sql,/n\.read is true/);
 assert.match(sql,/revoke all on function public\.ifund_my_echo_delivery_read_receipts\(\) from public,anon/);
 assert.match(page,/ifund_my_echo_delivery_read_receipts/);
 assert.match(page,/not email delivery, message replies or confirmed human attention/);
});
