import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("content creation is gated by an email account while public browsing stays open", () => {
  const app = read("../src/App.jsx");
  assert.match(app, /path="\/create" element=\{<MemberAccess><CreateCampaign \/><\/MemberAccess>\}/);
  assert.doesNotMatch(app, /path="\/discover" element=\{<MemberAccess>/);
});

test("guest drafts stay local until cloud save and never require login", () => {
  const creator = read("../src/pages/CreateCampaign.jsx");
  assert.match(creator, /rememberBrowserCampaign\(sessionStorage, ownerId, form,/);
  assert.match(creator, /forgetBrowserCampaign\(sessionStorage\)/);
  assert.match(creator, /key=\{[^}]*ownerId \|\| "guest"/);
  assert.match(creator, /rememberBrowserCampaign\(sessionStorage, null, form,/);
  assert.doesNotMatch(creator, /navigate\("\/login\?returnTo="/);
  assert.match(creator, /Draft saved in this browser tab only/);
});
