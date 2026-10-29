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
