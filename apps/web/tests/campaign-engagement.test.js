import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const sql=read("../../../supabase/migrations/20261113_ifund_owner_campaign_engagement.sql");
const page=read("../src/pages/CampaignEngagement.jsx");
const app=read("../src/App.jsx");

test("engagement report limits all campaign rows to current authenticated owner",()=>{
  assert.match(sql,/auth\.uid\(\)/);
  assert.match(sql,/ifund_current_account_is_active\(\)/);
  assert.match(sql,/c\.owner_id=caller/);
  assert.match(sql,/revoke all on function public\.ifund_owner_campaign_engagement\(\) from public,anon/);
  assert.match(sql,/limit 100/);
});

test("engagement summary counts only provider verified gifts and excludes identifying details",()=>{
  assert.match(sql,/d\.paypal_capture_verified_at is not null/);
  assert.match(sql,/d\.status='captured'/);
  assert.match(sql,/coalesce\(f\.archived,false\)=false/);
  assert.doesNotMatch(sql,/select [^\n]+email/i);
  assert.doesNotMatch(sql,/insert into|update [^\n]+ set|delete from/i);
});

test("campaign owner engagement page fails closed and requires login",()=>{
  assert.match(app,/path="\/engagement" element=\{<MemberAccess><CampaignEngagement \/><\/MemberAccess>\}/);
  assert.match(page,/rpc\("ifund_owner_campaign_engagement"\)/);
  assert.match(page,/No supporter identities or marketing contact permissions/);
  assert.match(page,/A follow is not consent to marketing outreach/);
  assert.match(page,/state\.phase === "error"/);
});
