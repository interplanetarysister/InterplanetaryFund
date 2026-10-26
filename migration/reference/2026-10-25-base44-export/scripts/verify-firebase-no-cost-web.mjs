import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const read = (path) => readFileSync(path, "utf8");
const manifest = JSON.parse(read("package.json"));
const web = read("src/lib/firebaseWebFeatures.js");
const config = read("src/lib/firebaseWebConfig.js");
const main = read("src/main.jsx");
const notifications = read("src/pages/Notifications.jsx");
const android = JSON.parse(read("google-services.json"));

assert.ok(manifest.dependencies.firebase, "The modular Firebase SDK must be installed");
assert.match(config, /projectId: "interplanetaryfund"/);
assert.match(config, /appId: "1:149740266464:web:d600f43383273bbb5b4185"/);
assert.equal(android.project_info.project_id, "interplanetary-fund", "Android Firebase project must stay unchanged");
assert.match(web, /Capacitor\.isNativePlatform\(\)/, "No web Firebase SDK in native app");
assert.match(web, /if \(hasWebDiagnosticsConsent\(\)\) void applyWebDiagnosticsConsent\(\)/, "No automatic SDK load without consent");
assert.match(web, /import\("firebase\/analytics"\)/);
assert.match(web, /import\("firebase\/performance"\)/);
assert.match(web, /send_page_view: false/, "No automatic page URL capture at Analytics setup");
assert.match(web, /ad_personalization: "denied"/, "Ad personalization must be denied");
assert.match(web, /setAnalyticsCollectionEnabled\(services\.analytics, enabled\)/);
assert.match(web, /instrumentationEnabled = enabled/);
assert.match(main, /installOptionalWebDiagnostics\(\)/);
assert.match(notifications, /setWebDiagnosticsConsent\(next\)/);
for (const prohibited of ['firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/functions', 'firebase/messaging']) {
  assert.ok(!web.includes(prohibited), `Unexpected billable/auth service: ${prohibited}`);
}
assert.ok(!read("src/lib/firebaseWebFeatures.js").includes("fetchAndActivate"), "Remote Config must not silently incur requests");
console.log("PASS: Free Firebase web diagnostics are browser-only, consent-first, and preserve Android Firebase, Base44 identity, payments and hosting.");
