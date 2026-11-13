import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const sql=read("../../../supabase/migrations/20261113_ifund_editorial_worker_turns.sql");
const ui=read("../src/components/agents/EditorialAgentQueue.jsx");

test("specialist turn recording is restricted to service-role and member users cannot impersonate agents",()=>{
 assert.match(sql,/auth\.role\(\) is distinct from 'service_role'/);
 assert.match(sql,/revoke all on function public\.ifund_record_editorial_worker_turn\(uuid,text,text,text,uuid\) from public,anon,authenticated/);
 assert.match(sql,/grant execute on function public\.ifund_record_editorial_worker_turn\(uuid,text,text,text,uuid\) to service_role/);
 assert.match(sql,/p_agent not in \('nexus','story','polaris','echo','orbit'\)/);
 assert.match(sql,/p_agent='nexus' and p_kind<>'agent_synthesis'/);
});

test("cross-agent critique/synthesis requires an independently recorded prior specialist and idempotency",()=>{
 assert.match(sql,/operation_id.*p_operation_id::text/);
 assert.match(sql,/from pg_catalog\.jsonb_array_elements\(v_notes\) as note\(value\)/);
 assert.match(sql,/note\.value->>'agent'<>p_agent/);
 assert.match(sql,/if p_kind in \('agent_critique','agent_synthesis'\) and not v_has_prior/);
 assert.match(sql,/provenance','service_worker_report'/);
 assert.match(ui,/Worker-reported critique/);
 assert.match(ui,/independent AI\/provider execution proof is not provided/);
});

test("claim queue is capped, leased, and cannot be invoked by a logged-in member",()=>{
 assert.match(sql,/p_limit not between 1 and 10/);
 assert.match(sql,/review_attempts<3/);
 assert.match(sql,/interval '20 minutes'/);
 assert.match(sql,/limit p_limit for update skip locked/);
 assert.match(sql,/revoke all on function public\.ifund_claim_editorial_agent_reviews\(integer\) from public,anon,authenticated/);
 assert.match(sql,/grant execute on function public\.ifund_claim_editorial_agent_reviews\(integer\) to service_role/);
});
