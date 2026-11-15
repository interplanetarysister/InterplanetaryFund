#!/usr/bin/env node
// Read-only mobile release checks. Never touches the legacy Base44 app.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(root, "../..");
const read = path => readFileSync(resolve(repo, path), "utf8");
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const mode = process.argv[2] || "--candidate";
if (!["--candidate", "--store"].includes(mode)) {
  console.error("Usage: node apps/mobile/scripts/verify-mobile.mjs [--candidate|--store]");
  process.exit(2);
}

const config = JSON.parse(read("apps/mobile/capacitor.config.json"));
const legacy = JSON.parse(read("apps/web/capacitor.config.json"));
const pkg = JSON.parse(read("apps/mobile/package.json"));
assert(config.appId === "com.interplanetaryfund.app", "Independent application ID must match the new mobile package");
assert(legacy.appId === "com.base6a67a778342a8fe05ee79cba.app", "Legacy Base44 identity changed: stop");
assert(config.appId !== legacy.appId, "Native package must not overwrite Base44");
assert(config.server?.url === "https://interplanetaryfund.com", "Native package must use canonical HTTPS live site");
assert(config.server?.cleartext === false, "Cleartext HTTP must remain disabled");
assert(config.server?.errorPath === "mobile-offline.html", "Native app must provide an offline recovery screen");
assert(existsSync(resolve(repo, "apps/web/public/mobile-offline.html")), "Offline screen is missing from the copied web assets");
assert(config.android?.allowMixedContent === false, "Android mixed content must remain disabled");
assert(!!pkg.dependencies?.["@capacitor/ios"] && !!pkg.dependencies?.["@capacitor/android"], "Both native platforms are required");
for (const name of ["android", "ios"]) {
  const workflow = read(".github/workflows/ifund-native-" + name + ".yml");
  assert(/workflow_dispatch:/.test(workflow), name + " native build must remain manually triggered");
  assert(!/^\s+(push|pull_request):/m.test(workflow), name + " native build must not auto-trigger");
  assert(workflow.includes("com.interplanetaryfund.app"), name + " workflow lacks independent identity assertion");
}

const manifest = JSON.parse(read("apps/web/ci/route-acceptance.json"));
assert(manifest.schema_version === 1 && Array.isArray(manifest.routes), "Unknown web acceptance manifest");
const unfinished = manifest.routes.filter(route =>
  route.source_status !== "source_ready" ||
  !route.source_evidence?.trim() ||
  !route.behavior_evidence?.trim() ||
  (route.role !== "public" && !route.backend_evidence?.trim())
);
if (mode === "--store") {
  assert(manifest.routes.length >= 80, "Incomplete canonical route inventory");
  assert(unfinished.length === 0, unfinished.length + " routes lack source/behavior/backend acceptance");
  const approval = resolve(root, "release-evidence.json");
  assert(existsSync(approval), "Store release requires independent evidence file, signed artifact and provider compliance review");
  // Evidence must be independently reviewed even when this file eventually exists.
  if (existsSync(approval)) {
    const evidence = JSON.parse(readFileSync(approval, "utf8"));
    for (const key of ["ios_device_passed", "android_device_passed", "auth_and_oauth_passed", "privacy_review_passed", "fundraising_policy_review_passed", "reviewer_approved"]) {
      assert(evidence[key] === true, key + " not independently verified");
    }
  }
}
if (errors.length) {
  console.error("IFund mobile " + mode + " blocked:\n - " + errors.join("\n - "));
  process.exit(1);
}
console.log("IFund mobile " + mode + " structural checks passed; " +
  unfinished.length + " canonical routes still lack complete acceptance. " +
  "Candidate compilation is NOT store or live-service certification.");
