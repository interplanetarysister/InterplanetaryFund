import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { safeNativePublicRoute } from "../src/lib/nativeLinks.js";

const ID = "11111111-1111-4111-8111-111111111111";
const site = "https://interplanetaryfund.com";

test("public native app links accept exact canonical public destinations", () => {
  for (const path of ["/", "/discover", "/atlas", "/campaign/" + ID]) {
    assert.equal(safeNativePublicRoute(site + path), path);
  }
});

test("native links refuse secret tokens, admin routes and any noncanonical website", () => {
  for (const url of [null, 12, "", "javascript:alert(1)",
    "https://evil.example/campaign/" + ID,
    "http://interplanetaryfund.com/campaign/" + ID,
    "https://interplanetaryfund.com.evil.example/campaign/" + ID,
    "https://interplanetaryfund.com/admin/audit",
    "https://interplanetaryfund.com/profile",
    "https://interplanetaryfund.com/auth/callback?code=secret",
    site + "/campaign/" + ID + "?token_hash=secret",
    site + "/campaign/" + ID + "#access_token=secret",
    site + "/campaign/%2e%2e/admin",
    site + "/campaign/" + ID + "/extra",
    site + "/campaign/../../admin",
    site + "/social/post/example",
    site + "/blogs/example",
    site + "/campaign/" + "a".repeat(2500),
  ]) {
    assert.equal(safeNativePublicRoute(url), "", String(url));
  }
});

test("native public links use the real App plugin and install before routing", () => {
  const module = readFileSync(new URL("../src/lib/nativeLinks.js", import.meta.url), "utf8");
  const main = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
  const pkg = JSON.parse(readFileSync(new URL("../../mobile/package.json", import.meta.url), "utf8"));
  assert.equal(pkg.dependencies["@capacitor/app"], "8.1.2");
  assert.match(module, /registerPlugin\("App"\)/);
  assert.match(module, /addListener\("appUrlOpen"/);
  assert.match(module, /safeNativePublicRoute\(raw\)/);
  assert.match(main, /installNativePublicLinks\(\)/);
});
