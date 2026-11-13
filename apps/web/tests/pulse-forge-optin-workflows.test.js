import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");

test("PULSE deadline watches need explicit owner opt-in and verified source updates",()=>{
 const sql=read("../../../supabase/migrations/20261113_ifund_pulse_opportunity_watches.sql");
 const ui=read("../src/pages/Institutions.jsx");
 assert.match(sql,/revoke all on public\.ifund_opportunity_watches from public,anon,authenticated/);
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/u\.email_confirmed_at is not null and u\.is_anonymous is false/);
 assert.match(sql,/o\.verified_at is not null/);
 assert.match(sql,/old\.deadline_date is not distinct from new\.deadline_date/);
 assert.match(sql,/insert into public\.ifund_notifications/);
 assert.match(sql,/revoke all on function public\.ifund_set_opportunity_watch\(text,boolean\) from public,anon/);
 assert.match(ui,/rpc\("ifund_set_opportunity_watch"/);
 assert.match(ui,/rpc\("ifund_my_opportunity_watches"/);
 assert.match(ui,/does not continuously monitor the provider website/);
});
test("FORGE outreach journal cannot send external posts and only closes owner-owned experiments",()=>{
 const sql=read("../../../supabase/migrations/20261113_ifund_growth_experiment_tracker.sql");
 const ui=read("../src/components/agents/GrowthExperimentTracker.jsx");
 const engagement=read("../src/pages/CampaignEngagement.jsx");
 assert.match(sql,/c\.owner_id=v_owner/);
 assert.match(sql,/e\.owner_id=v_owner/);
 assert.match(sql,/e\.owner_id=auth\.uid\(\)/);
 assert.match(sql,/revoke all on public\.ifund_growth_experiments from public,anon,authenticated/);
 assert.match(sql,/grant execute on function public\.ifund_close_growth_experiment\(uuid,text\) to authenticated/);
 assert.match(ui,/rpc\("ifund_create_growth_experiment"/);
 assert.match(ui,/rpc\("ifund_close_growth_experiment"/);
 assert.match(ui,/not a provider-verified conversion/);
 assert.match(engagement,/<GrowthExperimentTracker campaigns=\{state\.rows\} \/>/);
 assert.doesNotMatch(sql, /send_post|paypal|submit_external_application|http_post/i);
});
