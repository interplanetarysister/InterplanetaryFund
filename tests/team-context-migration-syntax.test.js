import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql=readFileSync(new URL("../supabase/migrations/20261115094500_ifund_shared_agent_team_events.sql",import.meta.url),"utf8");

test("history RPC grant uses all four PostgreSQL argument types",()=>{
  assert.match(sql,/grant execute on function public\.ifund_team_recent\(uuid,integer,timestamptz,uuid\) to authenticated;/i);
  assert.doesNotMatch(sql,/grant execute on function public\.ifund_team_recent\(uuid,integer\) to authenticated;/i);
});

test("correction function has paired named PostgreSQL dollar delimiters",()=>{
  assert.equal((sql.match(/\$team_correct\$/g)||[]).length,2);
  assert.match(sql,/as \$team_correct\$\s*declare[\s\S]*?end \$team_correct\$;/i);
  assert.doesNotMatch(sql,/\bas \$\s*declare/i);
});

test("team context does not grant direct table access or browser agent forgery",()=>{
  assert.match(sql,/revoke all on public\.ifund_agent_team_events from public,anon,authenticated;/i);
  assert.equal((sql.match(/perform ifund_workforce_runtime\.require_worker\(\);/g)||[]).length,2);
  assert.match(sql,/unique\(owner_id,event_key\)/i);
});
