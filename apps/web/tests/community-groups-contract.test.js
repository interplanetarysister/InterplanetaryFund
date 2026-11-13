import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const app = read("src/App.jsx");
const feed = read("src/pages/SocialFeedPage.jsx");
const page = read("src/pages/CommunityDetail.jsx");
const directory = read("src/components/community/CommunityDirectory.jsx");
const transport = read("src/api/communityGroups.js");
const schema = read("../../supabase/migrations/20261113_ifund_public_community_groups.sql");
const identity = read("../../supabase/migrations/20261113_ifund_community_verified_email_gate.sql");
const publicColumns = read("../../supabase/migrations/20261113_ifund_public_community_column_grants.sql");
const memberColumns = read("../../supabase/migrations/20261113_ifund_community_member_owner_privacy.sql");

test("community detail has its own route, not a ComingSoon fallback", () => {
  assert.match(app, /path="\/community\/:id" element=\{<CommunityDetail\s*\/>\}/);
  assert.match(feed, /community && <CommunityDirectory\s*\/>/);
  assert.match(directory, /listPublicCommunities\(\)/);
  assert.match(directory, /createCommunity\(form\)/);
  assert.match(page, /getPublicCommunity\(id\)/);
  assert.doesNotMatch(app, /LAYOUT_COMING_SOON = \["\/community\/:id"\]/);
});

test("community directory only uses new canonical tables, not Base44 legacy staging data", () => {
  assert.match(transport, /from\("ifund_member_communities"\)/);
  assert.match(transport, /from\("ifund_member_community_memberships"\)/);
  assert.doesNotMatch(transport, /\.from\("ifund_community"\)/);
  assert.match(directory, /No independently verified community groups/);
  assert.match(page, /Group-specific posting is not yet connected/);
});

test("community creation, join and leave require account identity and confirmed persistence", () => {
  assert.match(transport, /auth\.getUser\(\)/);
  assert.match(transport, /data\.user\.is_anonymous === true/);
  assert.match(transport, /owner_id: memberId/);
  assert.match(transport, /member_id: memberId/);
  assert.match(transport, /getMyMembership\(communityId\)/);
  assert.match(transport, /actual !== joining/);
  assert.match(page, /memberStatus !== "ready"/);
});

test("RLS denies anonymous writing and private member enumeration", () => {
  assert.match(schema, /enable row level security/g);
  assert.match(schema, /grant select on public\.ifund_member_communities to anon,authenticated/);
  assert.doesNotMatch(schema, /grant insert[^;]*to anon/i);
  assert.match(schema, /grant select on public\.ifund_member_community_memberships to authenticated/);
  assert.doesNotMatch(schema, /grant select on public\.ifund_member_community_memberships to anon/);
  assert.match(schema, /member_id=auth\.uid\(\)/g);
  assert.match(schema, /owner_id=auth\.uid\(\)/g);
  assert.match(identity, /ifund_private\.verified_email_creator\(\)/);
  assert.match(identity, /explicit_consent=true/);
  assert.match(identity, /2026-11-10-v4/);
  assert.match(publicColumns, /revoke select on public\.ifund_member_communities from anon/);
  assert.match(publicColumns, /grant select \(id,name,description,location,status,created_at\)/);
  assert.doesNotMatch(transport, /select\("id,name,description,location,created_at,owner_id"\)/);
  assert.match(memberColumns, /revoke select on public\.ifund_member_communities from authenticated/);
  assert.match(memberColumns, /grant select \(id,name,description,location,status,created_at,updated_at\)/);
  assert.doesNotMatch(transport, /select\("id,owner_id,name"\)/);
});
