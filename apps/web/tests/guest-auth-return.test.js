import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("campaign creation is accessible without MemberAccess", () => {
  const app = read("../src/App.jsx");
  assert.match(app, /path="\/create" element=\{<CreateCampaign \/>\}/);
  assert.doesNotMatch(app, /path="\/create" element=\{<MemberAccess>/);
});
test("guest draft survives authentication and is cleared after successful save", () => {
  const creator = read("../src/pages/CreateCampaign.jsx");
  assert.match(creator, /sessionStorage\.setItem\("ifund-guest-campaign-v1"/);
  assert.match(creator, /sessionStorage\.removeItem\("ifund-guest-campaign-v1"/);
  assert.match(creator, /navigate\("\/register\?returnTo="/);
});
test("auth retains the campaign return path and describes actual recovery options", () => {
  const auth = read("../src/pages/AuthPage.jsx");
  assert.match(auth, /emailRedirectTo: window\.location\.origin \+ "\/login\?returnTo="/);
  assert.match(auth, /open the secure recovery link/);
});
