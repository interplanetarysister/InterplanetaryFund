import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../../"+p,import.meta.url),"utf8");

test("device authorization schema stores only hashed credentials and limits grants",()=>{
 const sql=read("supabase/migrations/pending/20261029_ifund_device_authorization.sql");
 assert.match(sql,/device_code_hash text not null unique/);
 assert.match(sql,/user_code_hash text not null unique/);
 assert.match(sql,/access_token_hash text not null unique/);
 assert.doesNotMatch(sql,/device_code\s+text|user_code\s+text|access_token\s+text/i);
 assert.match(sql,/client_id in \('ifund-device-v1','ifund-cli-v1','ifund-agent-v1'\)/);
 assert.match(sql,/scopes <@ array\['identity:read','campaigns:read'\]/);
 assert.match(sql,/state in \('pending','approved','denied','revoked'\)/);
 assert.match(sql,/grant_expires_at/);
 assert.match(sql,/alter table public\.ifund_device_authorizations enable row level security/);
 assert.match(sql,/revoke all on public\.ifund_device_authorizations,public\.ifund_device_rate_limits from public,anon,authenticated/i);
 assert.doesNotMatch(sql,/create policy/i);
});

test("device authorization rate-limit storage is atomic-keyed and nonnegative",()=>{
 const sql=read("supabase/migrations/pending/20261029_ifund_device_authorization.sql");
 assert.match(sql,/create table public\.ifund_device_rate_limits/);
 assert.match(sql,/bucket_hash text primary key/);
 assert.match(sql,/request_count integer not null check \(request_count >= 0\)/);
});
