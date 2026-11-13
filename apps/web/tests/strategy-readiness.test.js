import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AGENT_WORKSPACES } from "../src/lib/agentWorkspaces.mjs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const sql = read("../../../supabase/migrations/20261113_ifund_strategy_readiness.sql");
const ui = read("../src/pages/CampaignStrategy.jsx");
const app = read("../src/App.jsx");

test("Strategy's no-inference tool reads only the caller's campaign records", () => {
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /ifund_current_account_is_active\(\)/);
  assert.match(sql, /where c\.owner_id=v_uid/);
  assert.match(sql, /revoke all on function public\.ifund_owner_campaign_strategy_readiness\(\) from public,anon/);
  assert.doesNotMatch(sql, /insert into|update public\.ifund_campaigns|delete from public\.ifund_campaigns/i);
});

test("Strategy workspace gives safe, non-autonomous editing guidance", () => {
  assert.match(ui, /rpc\("ifund_owner_campaign_strategy_readiness"\)/);
  assert.match(ui, /No new AI inference, grant submissions or fundraising claims/);
  assert.match(ui, /checks met/);
  assert.match(ui, /Cover check verifies only that a reference exists/);
  assert.match(ui, /\/campaigns\/"/);
  assert.match(app, /path="\/strategy" element=\{<MemberAccess><CampaignStrategy \/><\/MemberAccess>\}/);
  assert.equal(AGENT_WORKSPACES.find(x=>x.service==="strategy_agent")?.path,"/strategy");
});
