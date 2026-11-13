import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url),"utf8");

test("publication editors expose stable field focus targets",() => {
  const gate=read("../src/components/campaigns/PrepublicationGate.jsx");
  for(const page of ["CreateCampaign.jsx","EditCampaign.jsx"]) {
    const src=read("../src/pages/"+page);
    for(const id of ["campaign-title","campaign-summary","campaign-story"])
      assert.match(src,new RegExp('id="'+id+'"'));
  }
  assert.match(gate,/focusImprovementField/);
  assert.match(gate,/Go to suggested field/);
  assert.match(gate,/\.focus\(\{ preventScroll: true \}\)/);
});
test("PULSE notifications are keyed to individual watchers, not only the opportunity",() => {
  const sql=read("../../../supabase/migrations/20261113_ifund_pulse_opportunity_watches.sql");
  assert.match(sql,/v_watch\.owner_id::text/);
  assert.match(sql,/ifund_opportunity_watch_change_trigger/);
});
test("FORGE quota is race-safe and ECHO requires member opt-in",() => {
  const forge=read("../../../supabase/migrations/20261113_ifund_growth_experiment_tracker.sql");
  const echo=read("../../../supabase/migrations/20261113_ifund_echo_opted_in_updates.sql");
  assert.match(forge,/pg_advisory_xact_lock/);
  assert.match(echo,/outreach_opt_in is true/);
  assert.match(echo,/v_actual<>v_eligible/);
});
test("NEXUS scheduler is bounded and opt-in, with no external callback",() => {
  const sql=read("../../../supabase/migrations/20261113_ifund_nexus_scheduled_briefs.sql");
  const cron=read("../../../supabase/migrations/20261113_ifund_nexus_opted_in_daily_cron.sql");
  assert.match(sql,/where p\.enabled and p\.next_run_at<=now\(\)/);
  assert.match(sql,/p_limit not between 1 and 100/);
  assert.match(cron,/ifund-nexus-daily-briefs/);
  assert.match(cron,/0 15 \* \* \*/);
});
