import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
test("live and fundraising tips routes resolve to real public pages", () => {
  const routes = read("src/App.jsx");
  for (const [route, page] of [["/live", "IFundLive"], ["/fundraising-tips", "FundraisingTips"]]) {
    assert.match(routes, new RegExp('path="' + route + '" element={<'+page+' />}'));
    assert.ok(existsSync(new URL("../src/pages/" + page + ".jsx", import.meta.url)));
  }
});
test("news, blogs, social and live routes are linked through navigation", () => {
  const layout = read("src/components/Layout.jsx"), blogs = read("src/pages/Blogs.jsx");
  for (const route of ["/news", "/blogs", "/social", "/live", "/fundraising-tips"]) {
    assert.ok(layout.includes('to: "'+route+'"'), "sidebar missing " + route);
    assert.ok(blogs.includes('to="'+route+'"'), "editorial nav missing " + route);
  }
});
test("live hub never represents an unsupported livestream as active", () => {
  const live=read("src/pages/IFundLive.jsx");
  assert.match(live, /not yet available/);
  assert.match(live, /provider-backed session verification/);
  assert.match(live, /\/shorts/);
});
test("new routes remain fail closed until verified", () => {
  const manifest=JSON.parse(read("ci/route-acceptance.json"));
  for (const route of ["/live", "/fundraising-tips"]) {
    const row=manifest.routes.find(r=>r.route===route);
    assert.equal(row?.role, "public");
    assert.equal(row?.source_status, "not_verified");
  }
});
