import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const read = (name) => readFileSync(join(root, name), "utf8");
const app = read("src/App.jsx");

test("restored routes are linked to real component implementations", () => {
  for (const path of ["/profile", "/giving", "/social", "/community", "/mine", "/dashboard"]) {
    assert.ok(app.includes('path="' + path + '"'), path);
  }
  assert.match(app, /<Detail user=\{user\}/);
  assert.match(app, /<Connections user=\{user\}/);
});

test("campaign editor preserves the original four steps and private draft ownership", () => {
  const editor = read("src/pages/CampaignEditor.jsx");
  for (const step of ["Your Details", "Basics", "Your Story", "Launch"]) {
    assert.ok(editor.includes(step), step);
  }
  assert.match(editor, /params\.get\("draft"\)/);
  assert.match(editor, /\.eq\("owner_id", accountId\)/);
  assert.match(editor, /form\.story_versions/);
  assert.match(editor, /status === "active"/);
  assert.doesNotMatch(editor, /base44\.functions/);
});

test("verified connections are owner-scoped and not inferred from an OAuth claim", () => {
  const connections = read("src/pages/Connections.jsx");
  assert.match(connections, /\.eq\("owner_id", user\.id\)/);
  assert.match(connections, /connection\?\.status === "connected" && Boolean\(connection\.verified_at\)/);
});

test("social posting and deletion enforce author ownership", () => {
  const social = read("src/pages/Community.jsx");
  assert.match(social, /author_id: user\.id/);
  assert.match(social, /\.delete\(\)\.eq\("id", post\.id\)\.eq\("author_id", user\.id\)/);
  assert.match(social, /window\.confirm/);
});

test("giving history never mutates the existing PayPal ledger", () => {
  const giving = read("src/pages/MyGiving.jsx");
  assert.match(giving, /\.eq\("donor_id", user\.id\)/);
  assert.match(giving, /gift\.status === "captured"/);
  assert.doesNotMatch(giving, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
});

test("profile updates use owner-owned profile row, never metadata as RLS authority", () => {
  const profile = read("src/pages/Profile.jsx");
  assert.match(profile, /\.eq\("id", user\.id\)/);
  assert.match(profile, /onConflict: "id"/);
  assert.match(profile, /HANDLE = \/\^/);
});

test("discovery keeps original category filters and three-comparison limit", () => {
  const discover = read("src/pages/Discover.jsx");
  assert.match(discover, /compareIds/);
  assert.match(discover, /ids\.length < 3/);
  assert.match(discover, /setParams/);
  assert.match(discover, /Not yet available/);
});

test("offline migration preserves creator and donor access boundaries", () => {
  const sql = read("supabase/migrations/20261029172300_restore_campaign_wizard.sql");
  assert.match(sql, /ifund_campaign_cover_upload/);
  assert.match(sql, /ifund_profile_photo_upload/);
  assert.match(sql, /ifund_donations_donor_read/);
  assert.match(sql, /donor_id = \(select auth\.uid\(\)\)/);
});

test("home restores original slogan with no Base44 image host", () => {
  const feed = read("src/pages/Feed.jsx");
  assert.match(feed, /Endless possibilities start with one question:/);
  assert.doesNotMatch(feed, /media\.base44\.com/);
});

test("following reads and writes are scoped to the signed-in member", () => {
  const followed = read("src/pages/FollowedCampaigns.jsx");
  const detail = read("src/pages/CampaignDetail.jsx");
  const sql = read("supabase/migrations/20261029172300_restore_campaign_wizard.sql");
  assert.match(app, /path="\/following"/);
  assert.match(followed, /\.eq\("follower_id", user\.id\)/);
  assert.match(detail, /follower_id: user\.id/);
  assert.match(sql, /ifund_follows_member_insert/);
  assert.match(sql, /c\.status = 'active'/);
});

test("the independent Help Center exposes searchable articles and routes", () => {
  const help = read("src/pages/Help.jsx");
  const article = read("src/pages/HelpArticle.jsx");
  const content = read("src/lib/helpArticles.js");
  assert.match(app, /path="\/help"/);
  assert.match(app, /path="\/help\/:slug"/);
  assert.match(help, /setParams/);
  assert.match(article, /helpArticle\(slug\)/);
  assert.match(content, /resume-a-draft/);
});

test("Universal Inbox and notifications never fabricate message records", () => {
  const inbox = read("src/pages/Inbox.jsx");
  const notices = read("src/pages/Notifications.jsx");
  const sql = read("supabase/migrations/20261029172300_restore_campaign_wizard.sql");
  assert.match(inbox, /\.eq\("owner_id", user\.id\)/);
  assert.match(notices, /\.eq\("owner_id", user\.id\)/);
  assert.match(sql, /ifund_inbox_owner_select/);
  assert.match(sql, /ifund_notifications_owner_update/);
  assert.doesNotMatch(inbox + notices, /\.insert\(|fakeMessage|sampleMessages/);
});
test("Blogs keep private drafts and require verified publisher access", () => {
  const studio = read("src/pages/MyBlog.jsx");
  const blogs = read("src/pages/Blogs.jsx");
  const sql = read("supabase/migrations/20261029185500_restore_blogs.sql");
  assert.match(studio, /ifund_creator_access/);
  assert.match(studio, /ifund_blog_entries/);
  assert.match(blogs, /status", "published"/);
  assert.match(sql, /ifund_blog_entries_public_read/);
  assert.match(sql, /kind <> 'newsletter'/);
  assert.match(sql, /can_publish=true/);
});
test("Onboarding preferences never activate delegated OAuth permissions", () => {
  const onboarding = read("src/pages/Onboarding.jsx");
  const sql = read("supabase/migrations/20261029172300_restore_campaign_wizard.sql");
  assert.match(onboarding, /onboarding_completed: true/);
  assert.match(onboarding, /delegated permissions are activated/);
  assert.match(sql, /add column if not exists onboarding jsonb/);
  assert.doesNotMatch(onboarding, /setUnifiedOboConsent|base44/);
});
test("Mission Control uses only campaign records for local action suggestions", () => {
  const mission = read("src/pages/MissionControlPage.jsx");
  const review = read("src/lib/campaignReview.js");
  assert.match(mission, /campaignOverview/);
  assert.match(mission, /owner_id", user\.id/);
  assert.match(review, /reviewCampaign/);
  assert.doesNotMatch(mission, /generateIntelligence|base44/);
});
test("AI Team preserves source specialist roster but blocks fake conversations", () => {
  const agent = read("src/pages/Agents.jsx");
  const roster = read("src/lib/agentRoster.js");
  assert.match(agent, /AGENT_ROSTER/);
  assert.match(agent, /disabled/);
  assert.match(roster, /active: false/);
  assert.match(roster, /chief_of_staff/);
});
test("Founding member opt-in is user-owned and cancellable", () => {
  const members = read("src/pages/FoundingMembers.jsx");
  const sql = read("supabase/migrations/20261029172300_restore_campaign_wizard.sql");
  assert.match(members, /ifund_founding_members/);
  assert.match(members, /changeMembership/);
  assert.match(sql, /ifund_founding_member_self_leave/);
  assert.match(app, /path="\/founding-members"/);
});
