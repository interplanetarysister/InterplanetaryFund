import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const mobile = JSON.parse(read("../../mobile/capacitor.config.json"));
const legacy = JSON.parse(read("../capacitor.config.json"));
const packageJson = JSON.parse(read("../../mobile/package.json"));
const iosWorkflow = read("../../../.github/workflows/ifund-native-ios.yml");
const androidWorkflow = read("../../../.github/workflows/ifund-native-android.yml");

test("mobile identity is distinct from preserved Base44 package", () => {
  assert.equal(mobile.appId, "com.interplanetaryfund.app");
  assert.equal(legacy.appId, "com.base6a67a778342a8fe05ee79cba.app");
  assert.notEqual(mobile.appId, legacy.appId);
});

test("both new mobile shells share the canonical production service", () => {
  assert.equal(mobile.server.url, undefined, "Do not distribute a live-reload WebView");
  assert.equal(mobile.server.hostname, "localhost");
  assert.equal(mobile.server.iosScheme, "capacitor");
  assert.equal(mobile.server.androidScheme, "https");
  assert.equal(mobile.webDir, "../web/dist-mobile");
  assert.equal(mobile.plugins.CapacitorHttp.enabled, false);
  assert.match(read("../src/lib/nativeApi.js"), /IFUND_API_ORIGIN = "https:\/\/interplanetaryfund\.com"/);
  assert.equal(mobile.server.cleartext, false);
  assert.equal(mobile.android.allowMixedContent, false);
  assert.ok(packageJson.dependencies["@capacitor/android"]);
  assert.ok(packageJson.dependencies["@capacitor/ios"]);
  assert.ok(!packageJson.dependencies["@supabase/supabase-js"],
    "Native wrappers must use the canonical site's single server-side authorization architecture");
});

test("new native builds are manual-only and cannot deploy or overwrite Base44", () => {
  for (const [name, workflow] of [["iOS", iosWorkflow], ["Android", androidWorkflow]]) {
    assert.match(workflow, /workflow_dispatch:/, name + " requires manual dispatch");
    assert.doesNotMatch(workflow, /^\s+push:|^\s+pull_request:/m);
    assert.match(workflow, /com\.interplanetaryfund\.app/);
    assert.doesNotMatch(workflow, /cap(?:acitor)?\s+(?:sync|add)\s+(?:all|web)\b/i);
  }
  assert.match(iosWorkflow, /CODE_SIGNING_ALLOWED=NO/);
  assert.match(androidWorkflow, /assembleDebug/);
});

test("native candidate preflight succeeds but store release stays fail-closed", () => {
  const script = new URL("../../mobile/scripts/verify-mobile.mjs", import.meta.url);
  const candidate = spawnSync(process.execPath, [script.pathname, "--candidate"], { encoding: "utf8" });
  assert.equal(candidate.status, 0, candidate.stderr);
  assert.match(candidate.stdout, /NOT store or live-service certification/);
  const store = spawnSync(process.execPath, [script.pathname, "--store"], { encoding: "utf8" });
  assert.notEqual(store.status, 0, "Store readiness must fail until independently verified");
  assert.match(store.stderr, /reviewed, committed native dependency lockfile|Store release requires independent evidence|not independently verified/);
  for (const workflow of [iosWorkflow, androidWorkflow])
    assert.match(workflow, /node apps\/mobile\/scripts\/verify-mobile\.mjs --candidate/);
});
