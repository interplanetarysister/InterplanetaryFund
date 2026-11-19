import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { safeNativeAuthCallbackUrl } from "../src/lib/safeNativeAuthCallback.js";
import { emailAuthRedirectUrl, MOBILE_AUTH_CALLBACK } from "../src/lib/nativeEmailRedirect.js";

const site = "https://interplanetaryfund.com";
const code = "abcDEFG1234_ghij-KLMN4567";

test("website registration and reset links retain their original callbacks", () => {
  assert.equal(new URL(emailAuthRedirectUrl(site, "/dashboard")).pathname, "/auth/callback");
  assert.equal(new URL(emailAuthRedirectUrl(site, "/dashboard", true)).pathname, "/reset-password");
});

test("native registration and recovery use a distinct canonical HTTPS callback", () => {
  const signup = new URL(emailAuthRedirectUrl("capacitor://localhost", "/dashboard", false, true));
  const recovery = new URL(emailAuthRedirectUrl("https://localhost", "/dashboard", true, true));
  assert.equal(signup.origin, site);
  assert.equal(signup.pathname, MOBILE_AUTH_CALLBACK);
  assert.equal(signup.searchParams.get("returnTo"), "/dashboard");
  assert.equal(recovery.origin, site);
  assert.equal(recovery.pathname, MOBILE_AUTH_CALLBACK);
  assert.equal(recovery.searchParams.get("type"), "recovery");
});

test("only a canonical, mobile-specific PKCE code or hash is accepted", () => {
  assert.equal(safeNativeAuthCallbackUrl(site + MOBILE_AUTH_CALLBACK + "?code=" + code),
    site + MOBILE_AUTH_CALLBACK + "?code=" + code);
  const hash = "a".repeat(64);
  assert.equal(safeNativeAuthCallbackUrl(site + MOBILE_AUTH_CALLBACK +
    "?token_hash=" + hash + "&type=signup"),
    site + MOBILE_AUTH_CALLBACK + "?token_hash=" + hash + "&type=signup");
});

test("reject browser auth, unsigned origins, bearer fragments, duplicate and arbitrary parameters", () => {
  for (const link of [
    site + "/auth/callback?code=" + code,
    site + "/reset-password?code=" + code,
    site + MOBILE_AUTH_CALLBACK + "?code=" + code + "#access_token=leak",
    site + MOBILE_AUTH_CALLBACK + "?code=" + code + "&code=" + code,
    site + MOBILE_AUTH_CALLBACK + "?code=" + code + "&access_token=leak",
    site + MOBILE_AUTH_CALLBACK + "?code=" + code + "&returnTo=%2F%2Fevil.example",
    site + MOBILE_AUTH_CALLBACK + "?code=" + code + "&type=other",
    site + MOBILE_AUTH_CALLBACK + "?token_hash=" + "f".repeat(64),
    "https://evil.example/auth/mobile-callback?code=" + code,
    "http://interplanetaryfund.com/auth/mobile-callback?code=" + code,
    "capacitor://localhost/auth/mobile-callback?code=" + code,
    site + MOBILE_AUTH_CALLBACK + "?code=" + code + "&error=denied",
    site + "/admin/audit?code=" + code,
  ]) {
    assert.equal(safeNativeAuthCallbackUrl(link), "", "Refused: " + link);
  }
});

test("no web callback is consumed by a separate native PKCE session", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const authFlow = readFileSync(new URL("../src/lib/authFlow.js", import.meta.url), "utf8");
  const nativeAuth = readFileSync(new URL("../src/lib/nativeAuthLinks.js", import.meta.url), "utf8");
  const signup = readFileSync(new URL("../src/pages/AuthPage.jsx", import.meta.url), "utf8");
  const main = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
  assert.match(app, /path="\/auth\/mobile-callback"/);
  assert.match(authFlow, /"\/auth\/mobile-callback"/);
  assert.match(nativeAuth, /safeNativeAuthCallbackUrl\(raw\)/);
  assert.match(nativeAuth, /completeAuthCallback\(client\.auth, href\)/);
  assert.match(nativeAuth, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(main, /installNativeAuthLinks\(\)/);
  const mobileMain = readFileSync(new URL("../src/mobile-main.jsx", import.meta.url), "utf8");
  assert.match(mobileMain, /installNativePublicLinks\(\)/);
  assert.match(mobileMain, /installNativeAuthLinks\(\)/);
  assert.ok(mobileMain.indexOf("installNativeAuthLinks();") <
    mobileMain.indexOf("ReactDOM.createRoot("),
    "Install secure native PKCE listener before mounting the standalone store app");
  assert.match(signup, /emailAuthRedirectUrl\(/);
  assert.match(signup, /type: "signup"/);
});
