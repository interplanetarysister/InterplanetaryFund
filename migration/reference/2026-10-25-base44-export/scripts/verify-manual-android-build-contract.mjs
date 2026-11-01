import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// GitHub must retain its Android build capability without starting Gradle or
// publishing APKs as a consequence of ordinary frontend/source changes.
const workflows = ".github/workflows";
const androidPath = join(workflows, "android-debug-apk.yml");
assert.ok(existsSync(androidPath), "GitHub's optional APK build workflow must remain available");
const android = readFileSync(androidPath, "utf8");
const androidEvents = android.split(/^permissions:/m)[0];

assert.match(androidEvents, /^on:\s*\n  workflow_dispatch:/m, "Android builds must require a deliberate Run workflow action");
assert.doesNotMatch(
  androidEvents,
  /^  (?:push|pull_request|pull_request_target|schedule|workflow_run|repository_dispatch|workflow_call|release|create|delete|deployment|deployment_status):/m,
  "Android builds must never run from repository or web-deployment events",
);
assert.match(android, /inputs\.build_type == 'debug'/, "Manual debug APK path is missing");
assert.match(android, /inputs\.build_type == 'signed-release'/, "Manual signed-release path is missing");
assert.match(android, /:app:assembleDebug/, "Gradle debug compilation must stay available");
assert.match(android, /:app:assembleRelease/, "Gradle release compilation must stay available");
assert.match(android, /IFUND_ANDROID_KEYSTORE_B64/, "Release signing must require a secure keystore");
assert.match(android, /GITHUB_REF.*refs\/heads\/main/, "Signed release must be restricted to reviewed main");
assert.match(android, /apksigner.*verify/, "Produced APK signature verification is missing");

const nativeBuild = /(?:\.\/gradlew\b|:app:assemble(?:Debug|Release)\b|:app:bundleRelease\b|npx\s+cap\s+(?:sync|copy)\s+android\b|IFUND_ANDROID_KEYSTORE_B64)/;
for (const name of readdirSync(workflows).filter((name) => /\.ya?ml$/.test(name))) {
  if (name === "android-debug-apk.yml") continue;
  const workflow = readFileSync(join(workflows, name), "utf8");
  assert.doesNotMatch(workflow, nativeBuild, `Routine GitHub workflow ${name} must not build or sign Android`);
}

for (const path of ["android/gradlew", "android/app/build.gradle", "android/gradle/wrapper/gradle-wrapper.properties", "capacitor.config.json"]) {
  assert.ok(existsSync(path), `Preserve portable Android build input: ${path}`);
}
console.log("PASS: GitHub Android builds are manual-only; debug/release Gradle paths remain intact.");
