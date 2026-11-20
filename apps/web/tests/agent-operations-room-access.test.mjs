import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql=readFileSync(new URL("../../../supabase/migrations/20261120114500_ifund_agent_operations_room.sql",import.meta.url),"utf8");
const source=readFileSync(new URL("../src/components/agents/AgentOperationsRoom.jsx",import.meta.url),"utf8");

test("operations room keeps owner-only RLS and denies browser-side forged agent messages",()=>{
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on public\.ifund_agent_operations_messages from public, anon, authenticated/);
 assert.match(sql,/grant select, insert .* to authenticated/);
 assert.match(sql,/verified_admin_read_agent_operations/);
 assert.match(sql,/verified_admin_write_own_messages/);
 assert.match(sql,/public\.ifund_current_user_is_verified_admin\(\)/);
 assert.match(sql,/author_user_id=\(select auth\.uid\(\)\)/);
 assert.match(sql,/speaker_type='admin'/);
 assert.match(sql,/agent_id is null/);
 assert.match(sql,/source_kind='admin_post'/);
 assert.match(sql,/source_receipt is null/);
 assert.doesNotMatch(sql,/grant (?:update|delete|all) .* to authenticated/i);
});
test("agent messages cannot be forged by admin browser writes",()=>{
 assert.match(sql,/speaker_type='agent'.*agent_id is not null/);
 assert.match(sql,/source_kind='verified_agent_runtime'/);
 assert.match(sql,/source_receipt is not null/);
 assert.match(source,/client\.rpc\("ifund_current_user_is_verified_admin"\)/);
 assert.match(source,/speaker_type:"admin",author_user_id:ownerId/);
 assert.match(source,/source_kind:"admin_post"/);
 assert.doesNotMatch(source,/speaker_type:"agent"/);
});
test("operations room is private and usable with a single administrator message input",()=>{
 assert.match(source,/Private Agent Operations Room/);
 assert.match(source,/if\\(checking\\)return null/);
 assert.match(source,/if\\(!permitted\\)return null/);
 assert.match(source,/Only verified administrators can read or post/);
 assert.match(source,/Message type/);
 assert.match(source,/Administrator message/);
});
