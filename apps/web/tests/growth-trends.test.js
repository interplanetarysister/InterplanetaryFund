import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const sql=read("../../../supabase/migrations/20261113_ifund_owner_growth_trends.sql");
const widget=read("../src/components/agents/CampaignGrowthTrends.jsx");
const page=read("../src/pages/CampaignEngagement.jsx");

test("Growth trends limit all joins to canonical owned campaigns",()=>{
  assert.match(sql,/auth\.uid\(\)/);
  assert.match(sql,/ifund_current_account_is_active\(\)/);
  assert.match(sql,/where c\.owner_id=v_uid/);
  assert.match(sql,/revoke all on function public\.ifund_owner_growth_trends\(\) from public,anon/);
  assert.doesNotMatch(sql,/insert into|update\s+public\.ifund_|delete\s+from/i);
});

test("Growth capture activity is independently provider-backed and sandbox-free",()=>{
  assert.match(sql,/d\.status='captured'/);
  assert.match(sql,/d\.paypal_capture_verified_at is not null/);
  assert.match(sql,/d\.captured_at>=now\(\)-interval '7 days'/);
  assert.match(sql,/d\.captured_at>=now\(\)-interval '30 days'/);
  assert.match(sql,/f\.archived is not true/);
  assert.doesNotMatch(sql,/ifund_demo_/);
});

test("owner-facing Growth analytics fail closed and use actual campaign titles",()=>{
  assert.match(widget,/rpc\("ifund_owner_growth_trends"\)/);
  assert.match(widget,/state\.phase==="error"/);
  assert.match(widget,/Captures are provider-verified events, not net revenue/);
  assert.match(widget,/campaigns\.find\(item=>item\.campaign_id===row\.campaign_id\)/);
  assert.match(page,/CampaignGrowthTrends campaigns=/);
});
