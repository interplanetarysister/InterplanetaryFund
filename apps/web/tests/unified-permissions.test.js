import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../src/App.jsx");
const profile = read("../src/pages/Profile.jsx");
const signup = read("../src/pages/AuthPage.jsx");
const onboarding = read("../src/pages/MemberOnboarding.jsx");
const hub = read("../src/pages/ManagePermissions.jsx");
const ai = read("../src/components/permissions/AIPermissionPreferences.jsx");
const sql = read("../../../supabase/migrations/20261115010000_ifund_ai_permission_preferences.sql");

test("account navigation consolidates user-facing permissions", () => {
  assert.match(profile, /Manage iFund Permissions/);
  assert.match(onboarding, /to="\/permissions"/);
  assert.match(app, /path="\/permissions" element={<MemberAccess><ManagePermissions/);
  assert.match(app, /path="\/connections" element={<MemberAccess><ManagePermissions/);
  assert.match(app, /path="\/preferences" element={<Navigate to="\/permissions\?section=marketing"/);
  assert.match(hub, /<Connections\s*\/>/);
  assert.match(hub, /<MarketingPreferences\s*\/>/);
  assert.match(hub, /<AIPermissionPreferences\s*\/>/);
});

test("signup interest never silently grants third party authorization", () => {
  assert.match(signup, /ifund-signup-ai-interest-v1/);
  assert.match(signup, /false,allow_ai_outreach_drafts:false,interested_in_future_automation:false/);
  assert.match(ai, /email_confirmed_at/);
  assert.match(ai, /data\?\.user\?\.id/);
  assert.match(ai, /upsert\(payload/);
  assert.match(ai, /No external platform access was granted/);
  assert.doesNotMatch(sql, /grant\s+all\s+on\s+public\.ifund_ai_permission_preferences\s+to\s+anon/i);
  assert.match(sql, /owner_id = \(select auth\.uid\(\)\)/);
  assert.match(sql, /default 'ask'/);
});
