import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");

test("ECHO may only notify followed campaigns when recipients separately opted in",()=>{
 const sql=read("../../../supabase/migrations/20261113_ifund_echo_opted_in_updates.sql");
 const ui=read("../src/components/agents/EchoApprovedMessaging.jsx");
 assert.match(sql,/f\.campaign_id=p_campaign_id and f\.owner_id<>v_owner/);
 assert.match(sql,/m\.outreach_opt_in is true/);
 assert.match(sql,/m\.consented_at is not null/);
 assert.match(sql,/coalesce\(f\.notification_prefs->>'campaign_updates','true'\)<>'false'/);
 assert.match(sql,/c\.owner_id=v_owner and c\.status='active'/);
 assert.match(sql,/v_eligible>50/);
 assert.match(sql,/interval '24 hours'/);
 assert.match(sql,/v_actual<>v_eligible/);
 assert.match(sql,/v_previous_body<>btrim\(p_body\)/);
 assert.match(sql,/revoke all on public\.ifund_echo_inapp_deliveries from public,anon,authenticated/);
 assert.match(sql,/revoke all on function public\.ifund_echo_send_opted_in_update\(uuid,text,uuid\) from public,anon/);
 assert.match(ui,/approved&&?\!ready|\!approved\|\|\!ready/);
 assert.match(ui,/rpc\("ifund_echo_send_opted_in_update"/);
 assert.match(ui,/No email or social message is sent/);
 assert.match(ui,/not a provider-verified/);
});
test("NEXUS briefs are owner opt-in, service-only, and scheduler activation is not implicit",()=>{
 const sql=read("../../../supabase/migrations/20261113_ifund_nexus_scheduled_briefs.sql");
 const ui=read("../src/components/agents/NexusBriefSchedule.jsx");
 assert.match(sql,/enabled boolean not null default false/);
 assert.match(sql,/frequency_days in \(1,7\)/);
 assert.match(sql,/for update skip locked limit p_limit/);
 assert.match(sql,/on conflict\(canonical_operation_id\) where canonical_operation_id is not null do nothing/);
 assert.match(sql,/revoke all on function public\.ifund_dispatch_nexus_briefs\(integer\) from public,anon,authenticated/);
 assert.match(sql,/grant execute on function public\.ifund_dispatch_nexus_briefs\(integer\) to service_role/);
 assert.match(sql,/SEPARATE approved scheduler setup/);
 assert.match(ui,/rpc\("ifund_set_nexus_brief_preferences"/);
 assert.match(ui,/saving a preference is not confirmation of delivery/);
});
test("One manual release compiles once and archives tests plus bundle integrity evidence",()=>{
 const release=read("../../../.github/workflows/deploy-web-pages.yml");
 const rollback=read("../../../.github/workflows/rollback-web-pages.yml");
 assert.match(release,/workflow_dispatch:/);
 assert.doesNotMatch(release,/\n  push:|\n  pull_request:/);
 assert.equal((release.match(/npm run build/g)||[]).length,2); // build step and documented evidence string
 assert.match(release,/npm test 2>&1 \| tee/);
 assert.match(release,/ifund-single-build-evidence/);
 assert.match(release,/sha256sum --check/);
 assert.match(release,/branch=preview/);
 assert.match(release,/branch=main/);
 assert.match(rollback,/confirm:/);
 assert.match(rollback,/successful production deployment/);
 assert.doesNotMatch(rollback,/\n  push:/);
});
