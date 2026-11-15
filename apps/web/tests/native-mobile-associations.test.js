import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addAndroidAppLinks, iosEntitlements } from "../../mobile/scripts/configure-native-project.mjs";
import { generateAssociations } from "../../mobile/scripts/prepare-store-associations.mjs";

const syntheticTeam = "AB12CD34EF";
const syntheticFingerprint = Array.from({ length: 32 }, (_, i) =>
  i.toString(16).padStart(2, "0").toUpperCase()).join(":");

test("Android link filters are native-only, verified HTTPS and idempotent", () => {
  const original = '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application><activity android:name=".MainActivity"></activity></application></manifest>';
  const revised = addAndroidAppLinks(original);
  assert.match(revised, /android:autoVerify="true"/);
  assert.match(revised, /android:scheme="https"/);
  assert.match(revised, /android:host="interplanetaryfund.com"/);
  assert.match(revised, /android:path="\/auth\/mobile-callback"/);
  assert.doesNotMatch(revised, /android:path="\/auth\/callback"/);
  assert.match(revised, /android:pathPrefix="\/campaign\/"/);
  assert.equal(addAndroidAppLinks(revised), revised);
  assert.throws(() => addAndroidAppLinks("<nope/>"), /Unexpected AndroidManifest/);
});

test("iOS entitlements associate only the canonical domain", () => {
  const plist = iosEntitlements();
  assert.match(plist, /com\.apple\.developer\.associated-domains/);
  assert.match(plist, /applinks:interplanetaryfund\.com/);
  assert.doesNotMatch(plist, /base44/i);
});

test("store association files use real signing-identity fields, not Base44 identity", () => {
  const files = generateAssociations({
    teamId: syntheticTeam,
    fingerprint: syntheticFingerprint,
    appId: "com.interplanetaryfund.app",
  });
  assert.equal(files.apple.applinks.details[0].appID, syntheticTeam + ".com.interplanetaryfund.app");
  assert.ok(!files.apple.applinks.details[0].paths.includes("/auth/mobile-callback"), "Do not associate native OAuth before verified E2E acceptance");
  assert.ok(!files.apple.applinks.details[0].paths.includes("/auth/callback"));
  assert.equal(files.android[0].target.package_name, "com.interplanetaryfund.app");
  assert.deepEqual(files.android[0].target.sha256_cert_fingerprints, [syntheticFingerprint]);
});

test("native OAuth association requires explicit independently verified acceptance", () => {
  const verified = generateAssociations({
    teamId: syntheticTeam,
    fingerprint: syntheticFingerprint,
    appId: "com.interplanetaryfund.app",
    authVerified: true,
  });
  assert.ok(verified.apple.applinks.details[0].paths.includes("/auth/mobile-callback"));
  assert.throws(() => generateAssociations({
    teamId: syntheticTeam,
    fingerprint: syntheticFingerprint,
    appId: "com.interplanetaryfund.app",
    authVerified: "true",
  }), TypeError);
});

test("missing, placeholder and Base44 credentials fail closed", () => {
  const valid = {
    teamId: syntheticTeam, fingerprint: syntheticFingerprint,
    appId: "com.interplanetaryfund.app",
  };
  for (const input of [
    { ...valid, teamId: "" },
    { ...valid, teamId: "AAAAAAAAAA" },
    { ...valid, fingerprint: "00:00" },
    { ...valid, appId: "com.base6a67a778342a8fe05ee79cba.app" },
  ]) assert.throws(() => generateAssociations(input));
});

test("native workflows configure app links but never auto-release or touch Base44 APK", () => {
  for (const platform of ["android", "ios"]) {
    const wf = readFileSync(new URL("../../../.github/workflows/ifund-native-" +
      platform + ".yml", import.meta.url), "utf8");
    assert.match(wf, new RegExp("node scripts/configure-native-project\\.mjs " + platform));
    assert.match(wf, /workflow_dispatch:/);
    assert.doesNotMatch(wf, /^\s+(push|pull_request):/m);
  }
});
