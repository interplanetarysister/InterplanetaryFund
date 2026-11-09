import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("guest visitors can open the campaign creator without a login redirect", () => {
  const app = read("../src/App.jsx");
  assert.match(app, /path="\/create" element=\{<CreateCampaign \/>\}/);
  assert.doesNotMatch(app, /path="\/create" element=\{<MemberAccess>/);
});

test("guest drafts survive login and are cleared only after successful save", () => {
  const creator = read("../src/pages/CreateCampaign.jsx");
  assert.match(creator, /rememberBrowserCampaign\(sessionStorage, ownerId, form,/);
  assert.match(creator, /forgetBrowserCampaign\(sessionStorage\)/);
  assert.match(creator, /key=\{[^}]*ownerId \|\| "guest"/);
  assert.match(creator, /navigate\("\/login\?returnTo="/);
  assert.match(creator, /encodeURIComponent\(window\.location\.pathname \+ window\.location\.search\)/);
});
