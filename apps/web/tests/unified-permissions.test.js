import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../src/App.jsx");
const profile = read("../src/pages/Profile.jsx");
const signup = read("../src/pages/AuthPage.jsx");
const signupChoices = read("../src/lib/signupAIPreferences.js");
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

test("signup offers one AI Assistance switch without allowing outside actions", () => {
  assert.match(signupChoices, /ifund-signup-ai-interest-v1/);
  assert.match(signup, /Let iFund AI help me/);
  assert.match(signup, /role="switch"/);
  assert.match(signup, /allow_ai_campaign_drafts:event.target.checked/);
  assert.match(signup, /allow_ai_outreach_drafts:event.target.checked/);
  assert.match(signup, /allow_future_internal_ai_assistance:event.target.checked/);
  assert.match(onboarding, /turn iFund AI help on or off anytime/);
  assert.match(ai, /What does this include\?/);
  // Owner directive 2026-11-27: managing AI Assistance does not require a
  // confirmed email (verification is a withdrawals/payouts requirement).
  assert.doesNotMatch(ai, /email_confirmed_at/);
  assert.match(ai, /identity\?\.user/);
  assert.match(ai, /upsert\(payload/);
  assert.match(ai, /It does not automatically post to other websites/);
  assert.doesNotMatch(sql, /grant\s+all\s+on\s+public\.ifund_ai_permission_preferences\s+to\s+anon/i);
  assert.match(sql, /owner_id = \(select auth\.uid\(\)\)/);
  assert.match(sql, /default 'ask'/);
});
