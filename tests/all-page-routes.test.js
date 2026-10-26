import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sourcePageRoutes, sourceRoutePaths, sourceRouteCount, existingIndependentPagePaths } from "../src/lib/pageRoutes.js";

test("all 58 IFund source pages are inventoried without duplicates", () => {
  assert.equal(sourceRouteCount, 58);
  assert.equal(sourceRoutePaths.size, 58);
  for (const name of ["/register", "/forgot-password", "/reset-password", "/globe",
    "/embed/campaign/:id", "/oauth/consent", "/activate", "/u/:id",
    "/community/:id", "/help/:slug", "/dashboard", "/giving", "/ledger",
    "/withdrawals", "/ops", "/admin/organization-mail", "/admin/founding-members"]) {
    assert.ok(sourceRoutePaths.has(name), name);
  }
});
test("private and administrative IFund pages declare server-auth requirements", () => {
  for (const page of sourcePageRoutes) {
    assert.ok(["public", "member", "admin"].includes(page.access));
    assert.ok(page.path && page.title && page.kind);
    if (page.path.startsWith("/admin/")) assert.equal(page.access, "admin");
  }
});
test("original paths mount under independent role guards", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.ok(app.includes("sourcePageRoutes"));
  assert.ok(app.includes("IndependentRoute page={page}"));
  assert.ok(app.includes('page.access !== "public" && !user'));
  assert.ok(app.includes('page.access === "admin"'));
  assert.ok(app.includes("user?.app_metadata?.role"));
  for (const page of existingIndependentPagePaths) assert.ok(sourceRoutePaths.has(page));
});
test("unverified services do not silently activate privileged features", () => {
  const pub = readFileSync(new URL("../src/pages/RestoredPublic.jsx", import.meta.url), "utf8");
  const member = readFileSync(new URL("../src/pages/RestoredMember.jsx", import.meta.url), "utf8");
  assert.ok(pub.includes("VITE_IFUND_ENABLE_NEW_SIGNUPS"));
  assert.ok(pub.includes("VITE_IFUND_ENABLE_PASSWORD_RECOVERY"));
  assert.ok(member.includes("PayPal"));
  assert.ok(!pub.includes("base44Client") && !member.includes("base44Client"));
});
