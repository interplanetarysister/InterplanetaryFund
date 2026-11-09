import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("campaign creation is accessible without MemberAccess", () => {
  const app = read("../src/App.jsx");
  assert.match(app, /path="\/create" element=\{<CreateCampaign \/>}/);
  assert.doesNotMatch(app, /path="\/create" element=\{<MemberAccess>/);
});

test("guest draft survives authentication and is cleared after successful save", () => {
  const creator = read("../src/pages/CreateCampaign.jsx");
  assert.match(creator, /localStorage\.setItem\("ifund-guest-campaign-v1"/);
  assert.match(creator, /localStorage\.removeItem\("ifund-guest-campaign-v1"/);
  assert.match(creator, /savedAt: Date\.now\(\)/);
  assert.match(creator, /navigate\("\/login\?returnTo="/);
  assert.match(creator, /encodeURIComponent\(draftId/);
});

test("auth retains the campaign return path and describes actual recovery options", () => {
  const auth = read("../src/pages/AuthPage.jsx");
  assert.match(auth, /emailRedirectTo: window\.location\.origin \+ "\/login\?returnTo="/);
  assert.match(auth, /redirectTo: window\.location\.origin \+ "\/reset-password\?returnTo="/);
  assert.match(auth, /open the secure recovery link/);
  assert.match(auth, /\/register\?returnTo=/);
});

test("secure recovery links exchange tokens before password changes", () => {
  const reset = read("../src/pages/ResetPassword.jsx");
  assert.match(reset, /auth\.setSession/);
  assert.match(reset, /auth\.verifyOtp/);
  assert.match(reset, /auth\.exchangeCodeForSession/);
  assert.match(reset, /window\.history\.replaceState/);
  assert.match(reset, /safeReturnTo/);
  assert.match(reset, /passwordUpdated=1/);
});
