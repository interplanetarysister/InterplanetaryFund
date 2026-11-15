import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
  assert.equal(mobile.server.url, "https://interplanetaryfund.com");
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
