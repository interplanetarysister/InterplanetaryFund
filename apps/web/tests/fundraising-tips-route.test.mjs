import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = name => readFileSync(new URL(name, import.meta.url), "utf8");

test("fundraising guide is publicly routed, navigable, and inventoried", () => {
  const app = read("../src/App.jsx");
  const layout = read("../src/components/Layout.jsx");
  const manifest = JSON.parse(read("../ci/route-acceptance.json"));
  assert.match(app, /const FundraisingTips = lazy\(\(\) => import\("\.\/pages\/FundraisingTips"\)\)/);
  assert.match(app, /<Route path="\/fundraising-tips" element=\{<FundraisingTips \/>\} \/>/);
  assert.doesNotMatch(app, /<Route path="\/fundraising-tips" element=\{<MemberAccess>/);
  assert.ok((layout.match(/to: "\/fundraising-tips"/g) || []).length >= 2);
  assert.ok(manifest.routes.some(entry => entry.route === "/fundraising-tips" &&
    entry.role === "public" && entry.component === "FundraisingTips"));
});

test("guide respects donors and avoids linking to unfinished Live functionality", () => {
  const guide = read("../src/pages/FundraisingTips.jsx");
  assert.match(guide, /cannot guarantee donations/);
  assert.match(guide, /permission before showing other people/);
  assert.match(guide, /Avoid misleading urgency/);
  assert.match(guide, /Explore fundraisers/);
  assert.doesNotMatch(guide, /to="\/live"/);
  assert.doesNotMatch(guide, /return <main className=/);
});
