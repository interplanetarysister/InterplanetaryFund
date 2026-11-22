import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
test("public campaign donations are capped at five verified unreversed gifts",()=>{
 const sql=read("../../supabase/migrations/20261121_ifund_public_donation_visibility.sql");
 assert.match(sql,/row_number\(\) over \(partition by d\.campaign_id order by d\.captured_at desc,d\.id desc\)/);
 assert.match(sql,/where recent_rank<=5/);assert.match(sql,/d\.paypal_capture_verified_at is not null/);
 assert.match(sql,/d\.status='captured'/);assert.match(sql,/coalesce\(d\.refunded_cents,0\)=0/);
});
test("public donation projection excludes private identity and provider metadata",()=>{
 const sql=read("../../supabase/migrations/20261121_ifund_public_donation_visibility.sql");
 const view=sql.slice(sql.indexOf("create or replace view"),sql.indexOf("revoke all on public.ifund_campaign_recent_donations"));
 for(const key of ["donor_id","paypal_order_id","paypal_capture_id","payer_email","public_message"])assert.doesNotMatch(view,new RegExp(key));
 assert.match(view,/else 'Anonymous'/);
});
test("campaign page renders the five most recent donations and Cash App direct link",()=>{
 const api=read("../../apps/web/src/api/publicData.js"),page=read("../../apps/web/src/pages/CampaignDetail.jsx"),dialog=read("../../apps/web/src/components/payments/CampaignDonationDialog.jsx");
 assert.match(api,/ifund_campaign_recent_donations/);assert.match(api,/\.limit\(5\)/);
 assert.match(page,/Recent donations/);assert.match(page,/donation\.donor_display_name \|\| "Anonymous"/);
 assert.match(dialog,/CashAppDonateButton/);assert.match(dialog,/campaign\?\.cashapp_tag/);
});
test("public name is opt-in and Cash App destination is campaign-owner supplied",()=>{
 const dialog=read("../../apps/web/src/components/payments/CampaignDonationDialog.jsx"),worker=read("../../workers/ifund-payments/worker.js"),editor=read("../../apps/web/src/pages/EditCampaign.jsx");
 assert.match(dialog,/Show my donation publicly/);assert.match(dialog,/maxLength=\{60\}/);
 assert.match(worker,/input\.display_name_public===true/);assert.match(worker,/public_display_name\.trim\(\)\.length>60/);
 assert.match(editor,/campaign-cashapp-tag/);assert.match(editor,/cashapp_tag/);
});
