import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../supabase/migrations/20261126185000_ifund_agent_question_completion_nullable.sql",import.meta.url),"utf8");
test("agent chat completion clears its reservation expiry without violating schema",()=>{
  assert.match(sql,/alter table public\.ifund_agent_question_usage\s+alter column reservation_expires_at drop not null/i);
  assert.match(sql,/completed questions must clear expiry/i);
  assert.doesNotMatch(sql,/grant\s+(?:all|select|insert|update|delete)/i);
});
