import test from "node:test";
import assert from "node:assert/strict";
import { validateAndroidSdk, androidSdkFacts } from "../../mobile/scripts/verify-android-sdk.mjs";

const valid = "ext {\n minSdkVersion = 24\n compileSdkVersion = 36\n targetSdkVersion = 36\n }\n";
test("Capacitor 8 generated Android must target current Google Play API 36", () => {
  assert.deepEqual(androidSdkFacts(valid), {
    minSdkVersion: 24, compileSdkVersion: 36, targetSdkVersion: 36,
  });
  assert.deepEqual(validateAndroidSdk(valid).targetSdkVersion, 36);
  for (const config of [
    valid.replace("targetSdkVersion = 36", "targetSdkVersion = 35"),
    valid.replace("compileSdkVersion = 36", "compileSdkVersion = 35"),
    valid.replace("minSdkVersion = 24", "minSdkVersion = 21"),
  ]) assert.throws(() => validateAndroidSdk(config), /Google Play 2026/);
});
test("Android SDK verification refuses missing and ambiguous values", () => {
  assert.throws(() => androidSdkFacts(""), /Ambiguous Android SDK setting/);
  assert.throws(() => androidSdkFacts(valid + "targetSdkVersion = 34"), /Ambiguous Android SDK setting/);
  assert.throws(() => androidSdkFacts(null), TypeError);
});
