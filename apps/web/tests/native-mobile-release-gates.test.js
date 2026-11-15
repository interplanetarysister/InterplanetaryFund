import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setAndroidVersion } from "../../mobile/scripts/set-android-version.mjs";
import { safeSupabaseAuthorizationUrl } from "../src/lib/nativeOAuth.js";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const origin = "https://ssibsfmtodgximseeqsv.supabase.co/auth/v1/authorize";
const nativeCallback = "https://interplanetaryfund.com/auth/mobile-callback";

test("native OAuth authorizations permit only Supabase host and the device PKCE callback", () => {
  const good = new URL(origin);
  good.searchParams.set("provider", "google");
  good.searchParams.set("redirect_to", nativeCallback + "?returnTo=%2Fdashboard");
  assert.equal(safeSupabaseAuthorizationUrl(good.href), good.href);
  for (const bad of [
    origin + "?provider=google",
    origin + "?provider=google&redirect_to=https%3A%2F%2Fevil.example%2Fcallback",
    origin + "?provider=google&redirect_to=https%3A%2F%2Finterplanetaryfund.com%2Fauth%2Fcallback",
    origin + "?provider=github&redirect_to=" + encodeURIComponent(nativeCallback),
    "http://ssibsfmtodgximseeqsv.supabase.co/auth/v1/authorize?provider=google",
  ]) assert.equal(safeSupabaseAuthorizationUrl(bad), "", bad);
});

test("signed Android versions are unique, monotonic positive integers and independent", () => {
  const original = 'android { defaultConfig { versionCode 1 versionName "1.0" } }';
  assert.equal(setAndroidVersion(original, 123, "0.1.0").includes('versionCode 123 versionName "0.1.0"'), true);
  for (const value of [0, -1, 2100000000, Number.NaN, "not-a-number"])
    assert.throws(() => setAndroidVersion(original, value, "0.1.0"));
  assert.throws(() => setAndroidVersion(original, 3, "release"));
  assert.throws(() => setAndroidVersion("android {}", 3, "0.1.0"));
});

test("native Google, Facebook and Apple sign-in flags stay gated before provider verification", () => {
  const component = read("../src/components/auth/OAuthButtons.jsx");
  const oauth = read("../src/lib/nativeOAuth.js");
  assert.match(component, /VITE_NATIVE_OAUTH_VERIFIED === "1"/);
  assert.match(component, /VITE_NATIVE_APPLE_SIGNIN_READY === "1"/);
  assert.match(component, /native && !nativeOAuthAllowed/);
  assert.match(oauth, /skipBrowserRedirect: true/);
  assert.match(oauth, /safeSupabaseAuthorizationUrl\(data\?\.url\)/);
  assert.match(oauth, /redirect\.pathname !== MOBILE_AUTH_CALLBACK/);
});

test("store workflow gates are manual and evidence-loaded without adding an app release", () => {
  for (const os of ["ios", "android"]) {
    const signed = read("../../../.github/workflows/ifund-native-" + os + "-signed.yml");
    const debug = read("../../../.github/workflows/ifund-native-" + os + ".yml");
    assert.match(signed, /workflow_dispatch:/);
    assert.doesNotMatch(signed, /^\s+(push|pull_request):/m);
    assert.match(signed, /environment: native-store-release/);
    assert.match(signed, /IFUND_NATIVE_RELEASE_EVIDENCE_B64/);
    assert.match(signed, /node apps\/mobile\/scripts\/verify-mobile\.mjs --store/);
    assert.match(signed, /com\.interplanetaryfund\.app/);
    assert.doesNotMatch(signed, /app-store-connect.*upload|google-play.*publish/i);
    assert.match(debug, /node apps\/mobile\/scripts\/verify-mobile\.mjs --candidate/);
  }
});

test("profile deletion initiation is visible in My Profile and creates an authenticated support ticket", () => {
  const profile = read("../src/pages/Profile.jsx");
  const ticket = read("../src/pages/SupportTickets.jsx");
  assert.match(profile, /to="\/support\?request=delete-account"/);
  assert.match(ticket, /requestingDeletion/);
  assert.match(ticket, /ifund_create_support_ticket/);
  assert.match(ticket, /does not immediately erase your account/i);
  // Request initiation does NOT prove server-side deletion completion.
});

test("native payment collection and paid enrollment remain disabled pending review", () => {
  const native = read("../src/lib/nativeApi.js");
  const plans = read("../src/pages/Subscriptions.jsx");
  const publicPlans = read("../src/pages/PublicSubscriptionPlans.jsx");
  assert.match(native, /native_checkout_requires_approval/);
  assert.match(plans, /native\|\|!available/);
  assert.match(plans, /if\(native\)\{setError/);
  assert.match(publicPlans, /available && !native/);
});
