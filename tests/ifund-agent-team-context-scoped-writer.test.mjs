import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const migration=readFileSync(new URL("../supabase/migrations/20261125211000_ifund_team_question_user_writer.sql",import.meta.url),"utf8");
const context=readFileSync(new URL("../worker/agents/teamContext.js",import.meta.url),"utf8");
const question=readFileSync(new URL("../worker/agents/teamQuestion.js",import.meta.url),"utf8");

test("new user-side team writer uses only existing production or restricted team Question worker proof",()=>{
 assert.match(migration,/create or replace function public\.ifund_team_record_user/i);
 assert.match(migration,/public\.ifund_team_member_id\(\)/);
 assert.match(migration,/ifund_workforce_runtime\.channel\(\) is null/);
 assert.match(migration,/and not ifund_workforce_runtime\.team_question_writer_verified\(\)/);
 assert.match(migration,/Owned campaign required/);
 assert.match(migration,/Conversation event key conflicts/);
 assert.match(migration,/revoke all on function public\.ifund_team_record_user\(uuid,text,text,uuid\) from public,anon/);
 assert.match(migration,/grant execute on function public\.ifund_team_record_user\(uuid,text,text,uuid\) to authenticated/);
 assert.doesNotMatch(migration,/alter table .*disable row level security/i);
 assert.doesNotMatch(migration,/grant execute .* to public,anon/i);
});

test("chat context stays explicitly disabled until the matching writer key is securely provisioned",()=>{
 assert.match(context,/IFUND_TEAM_CONTEXT_ENABLED!==\"enabled\"/);
 assert.match(context,/IFUND_WORKFORCE_EXECUTOR_KEY/);
 assert.match(question,/IFUND_TEAM_CONTEXT_ENABLED === \"enabled\"/);
 assert.match(context,/ifund_team_record_/);
 assert.doesNotMatch(migration,/update ifund_ops\.team_question_writer_control set .*enabled\s*=\s*true/);
});

test("model skills remain approved-only, and high-risk actions are not granted by the migration",()=>{
 assert.match(question,/ifund_training_approved_skills/);
 assert.match(question,/status:\"completed\"|completed/);
 assert.doesNotMatch(migration,/grant .* service_role.*to /i);
 assert.doesNotMatch(migration,/IFUND_OPS_AUTONOMY_ENABLED/);
});
