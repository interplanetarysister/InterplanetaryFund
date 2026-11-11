import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL("../"+p,import.meta.url),"utf8");
const app=read("src/App.jsx");
const source=read("src/lib/followedCampaigns.js");
const gate=read("src/components/auth/MemberAccess.jsx");
const sql=read("../../supabase/migrations/pending/20261101_ifund_legal_acceptance_and_follows.sql");

test("source-aligned following is implemented as a real guarded route",()=>{
  assert.match(app, /path="\/following" element={<MemberAccess><FollowedCampaigns \/><\/MemberAccess>}/);
  for(const p of ["/profile","/connections","/campaigns"]) assert.match(app,new RegExp('path="'+p+'".*<MemberAccess>'));
  assert.match(app, /path="\/create" element={<MemberAccess><CreateCampaign \/><\/MemberAccess>}/);
  assert.match(app, /path="\/dashboard" element={<Dashboard \/>}/);
  assert.doesNotMatch(source,/base44Client|service_role|SUPABASE_SERVICE_ROLE_KEY/);
});
test("owner and campaign IDs are derived from auth and RLS",()=>{
  assert.match(source,/client\.auth\.getUser/);
  assert.match(source,/\.eq\("owner_id",owner\)/);
  assert.match(source,/\.eq\("status","active"\)/);
  assert.match(source,/ignoreDuplicates:true/);
  assert.match(source,/Object\.keys\(DEFAULT_FOLLOW_PREFS\)/);
  assert.doesNotMatch(source,/\.select\("\*"\)/);
});
test("consent is explicit and verified against current version",()=>{
  assert.match(gate,/TERMS_VERSION/);
  assert.match(gate,/type="checkbox"/);
  assert.match(gate,/ifund_legal_acceptances/);
  assert.match(gate,/data\?\.explicit_consent !== true/);
  assert.match(gate,/ifund_profiles/);
  assert.match(gate,/account_deletion_pending/);
  assert.doesNotMatch(gate,/base44Client|localStorage.*consent/);
});
test("follow SQL is least-privilege and does not recreate financial tables",()=>{
  assert.match(sql,/create table public\.ifund_follows/);
  assert.match(sql,/unique \(owner_id, campaign_id\)/);
  assert.match(sql,/alter table public\.ifund_follows enable row level security/);
  assert.match(sql,/grant insert \(owner_id, terms_version, explicit_consent\)/);
  assert.match(sql,/ifund_follows_owner_insert/);
  assert.match(sql,/ifund_current_account_is_active/);
  assert.match(sql,/ifund_legal_acceptances/);
  assert.match(sql,/jsonb_typeof/);
  assert.doesNotMatch(sql,/create table public\.ifund_notifications|create table public\.ifund_donations|create table public\.ifund_payment_events/);
  assert.doesNotMatch(sql,/grant .* on public\.ifund_follows to anon/);
});
