import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = name => readFileSync(new URL("../" + name, import.meta.url), "utf8");

test("administrator index exists, is linked, and is not accessible without verified admin", () => {
  const app = read("src/App.jsx");
  const layout = read("src/components/Layout.jsx");
  const page = read("src/pages/AdminHub.jsx");
  assert.match(app, /path="\/admin" element=\{<MemberAccess><AdminAccess><AdminHub \/><\/AdminAccess><\/MemberAccess>\}/);
  assert.match(layout, /to: "\/admin", label: "Admin Home"/);
  assert.match(page, /useSuperAdminAccess\(user\)/);
  assert.match(page, /elevated === "super-admin"/);
  assert.match(page, /showRestricted \? \[\.\.\.common, \.\.\.restricted\] : common/);
  assert.match(page, /role="status"/);
});
test("admin hub only offers existing destinations and never unguards privileged pages", () => {
  const app = read("src/App.jsx");
  const page = read("src/pages/AdminHub.jsx");
  for (const route of [
    "/admin/integrations", "/admin/sustainability", "/admin/social-moderation",
    "/admin/finance", "/admin/audit", "/admin/studio", "/admin/help", "/ops", "/platform",
  ]) {
    assert.ok(page.includes('to: "' + route + '"'), "Missing admin card: " + route);
    assert.ok(app.includes('path="' + route + '"'), "Card route not registered: " + route);
  }
  for (const path of ["/admin/audit", "/admin/studio", "/admin/help", "/ops", "/platform"])
    assert.match(app, new RegExp('path="' + path + '"[^\\n]*<SuperAdminAccess>'));
  assert.doesNotMatch(page, /service_role|SUPABASE_SECRET_KEY|auth\\.jwt|window\\.localStorage/);
});
