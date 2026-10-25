import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));

const expectedProject = 'interplanetary-fund';
const expectedPackage = 'com.base6a67a778342a8fe05ee79cba.app';

const config = json('capacitor.config.json');
const projectJson = json('google-services.json');
const nativeJson = json('android/app/google-services.json');
const nativePackage = nativeJson.client?.[0]?.client_info?.android_client_info?.package_name;

assert.equal(config.appId, expectedPackage, 'Capacitor must match the Firebase Android package');
assert.equal(nativePackage, expectedPackage, 'Native google-services.json package mismatch');
assert.equal(nativeJson.project_info.project_id, expectedProject, 'Unexpected Firebase project');
assert.equal(projectJson.project_info.project_id, expectedProject, 'Unexpected root Firebase project');
assert.deepEqual(nativeJson, projectJson, 'Native config differs from the provided root config');
assert.ok(!config.server?.url, 'Production Android must not rely on a remote live-reload server');
assert.equal(config.webDir, 'dist', 'Android bundles the existing IFund frontend');

const appGradle = read('android/app/build.gradle');
const rootGradle = read('android/build.gradle');
const androidManifest = read('android/app/src/main/AndroidManifest.xml');
const packageJson = json('package.json');
const nativeActivity = read('android/app/src/main/java/com/base6a67a778342a8fe05ee79cba/app/MainActivity.java');

assert.ok(appGradle.includes('applicationId "' + expectedPackage + '"'), 'Incorrect Android applicationId');
assert.ok(appGradle.includes("implementation platform('com.google.firebase:firebase-bom:35.0.0')"), 'Missing Firebase BoM');
assert.ok(appGradle.includes("implementation 'com.google.firebase:firebase-common'"), 'Missing basic Firebase runtime');
assert.ok(appGradle.includes("apply plugin: 'com.google.gms.google-services'"), 'Google Services plugin must apply');
assert.ok(rootGradle.includes("classpath 'com.google.gms:google-services:4.5.0'"), 'Incorrect Google Services Gradle plugin');
assert.ok(nativeActivity.includes('extends BridgeActivity'), 'Native Android activity not present');
assert.ok(androidManifest.includes('android:allowBackup="false"'), 'App data backup should not expose saved session tokens');
assert.ok(androidManifest.includes('android.permission.INTERNET'), 'Android web app requires Internet access');
assert.ok(androidManifest.includes('android:usesCleartextTraffic="false"'), 'Native Android must disallow plaintext HTTP');
assert.ok(androidManifest.includes('firebase_crashlytics_collection_enabled'), 'Crashlytics opt-in metadata missing');
assert.ok(androidManifest.includes('android:value="false"'), 'Crash telemetry must default to off');
assert.ok(appGradle.includes("implementation 'com.google.firebase:firebase-crashlytics'"), 'Missing Crashlytics SDK');
assert.ok(rootGradle.includes('firebase-crashlytics-gradle:3.0.8'), 'Missing Crashlytics build plugin');
assert.ok(nativeActivity.includes('registerPlugin(IfundDiagnosticsPlugin.class)'), 'Missing native crash-report consent plugin');
assert.ok(read('android/app/src/main/java/com/base6a67a778342a8fe05ee79cba/app/IfundDiagnosticsPlugin.java').includes('setCrashlyticsCollectionEnabled'), 'User crash consent control missing');
assert.ok(config.plugins?.CapacitorHttp?.enabled === true, 'Native HTTP transport must be enabled for Android WebView API access');
assert.equal(packageJson.dependencies['@capacitor/push-notifications'], '8.0.3');
assert.ok(read('src/pages/Login.jsx').includes('CapacitorHttp.post'), 'Missing Android native HTTPS login route');
assert.ok(read('src/pages/Login.jsx').includes('https://interplanetaryfund.base44.app'), 'Native login must use canonical Base44 HTTPS backend');
assert.ok(read('src/lib/androidFirebaseFeatures.js').includes('PushNotifications.requestPermissions'), 'Push must require consent');
assert.ok(read('src/lib/androidFirebaseFeatures.js').includes('registerPushDevice'), 'Push token registry missing');
assert.ok(read('base44/functions/registerPushDevice/entry.ts').includes('assertActiveAccount'), 'Push registration backend must validate user identity');
assert.ok(read('base44/entities/PushDevice.jsonc').includes('"role": "admin"'), 'Push tokens must not be public records');
assert.ok(!appGradle.includes("firebase-auth'"), 'Firebase must not replace existing Base44 authentication');
assert.equal(packageJson.dependencies['@capacitor/core'], '8.4.3');
assert.equal(packageJson.dependencies['@capacitor/android'], '8.4.3');
assert.equal(packageJson.devDependencies['@capacitor/cli'], '8.4.3');

assert.ok(read('src/pages/Login.jsx').includes('base44.auth.setToken'), 'Base44 authentication changed');
assert.ok(read('src/pages/Register.jsx').includes('base44.auth.register'), 'Base44 registration changed');
assert.ok(read('wrangler.toml').includes('IFUND_BASE44_ORIGIN'), 'Existing hosting data plane changed');
assert.equal(existsSync('firebase.json'), false, 'Firebase Hosting/deployment config not expected');

// Shared-source parity: when a website build exists, the packaged native web
// assets must match it exactly. This is not a distributed-APK verification.
if (existsSync('dist/index.html')) {
  const distRoot = 'dist';
  const nativeRoot = 'android/app/src/main/assets/public';
  assert.ok(existsSync(nativeRoot + '/index.html'), 'Android assets are missing; run npx cap copy android');
  let verifiedFiles = 0;
  function verifyDir(relative = '') {
    for (const name of readdirSync(distRoot + (relative ? '/' + relative : ''))) {
      const next = relative ? relative + '/' + name : name;
      if (statSync(distRoot + '/' + next).isDirectory()) {
        verifyDir(next);
      } else {
        assert.ok(existsSync(nativeRoot + '/' + next), 'Android missing web asset ' + next);
        assert.deepEqual(readFileSync(nativeRoot + '/' + next), readFileSync(distRoot + '/' + next),
          'Android web asset differs from website build: ' + next);
        verifiedFiles++;
      }
    }
  }
  verifyDir();
  console.log('PASS: Android project web assets match the current website build (' + verifiedFiles + ' files).');
}
console.log('PASS: Android scaffold and Firebase config match; Base44 auth, hosting and existing account model are preserved.');
console.log('NOTE: Device sign-in, OAuth, FCM delivery and crash opt-in must be verified before Google Play release.');
