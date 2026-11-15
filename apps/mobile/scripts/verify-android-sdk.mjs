#!/usr/bin/env node
// Verify actual generated Android Gradle settings before building a Play AAB.
// Safe read-only checks; never touches the legacy Base44 project.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export function androidSdkFacts(source) {
  if (typeof source !== "string") throw new TypeError("Android variables.gradle missing");
  const keys = ["minSdkVersion", "compileSdkVersion", "targetSdkVersion"];
  const values = {};
  for (const key of keys) {
    const matches = [...source.matchAll(new RegExp("\\b" + key + "\\s*=\\s*(\\d+)\\b", "g"))];
    if (matches.length !== 1) throw new Error("Ambiguous Android SDK setting: " + key);
    values[key] = Number(matches[0][1]);
  }
  return values;
}
export function validateAndroidSdk(source) {
  const facts = androidSdkFacts(source);
  if (facts.minSdkVersion < 24 || facts.compileSdkVersion !== 36 || facts.targetSdkVersion !== 36)
    throw new Error("Google Play 2026 requires Capacitor 8 SDK configuration: min 24, compile 36, target 36");
  return facts;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const config = JSON.parse(readFileSync(resolve(app, "capacitor.config.json"), "utf8"));
    if (config.appId !== "com.interplanetaryfund.app")
      throw new Error("Refusing to verify a non-IFund or Base44 app");
    const sdk = validateAndroidSdk(readFileSync(resolve(app, "android/variables.gradle"), "utf8"));
    console.log("Verified independent Android SDK settings: " + JSON.stringify(sdk));
    console.log("16 KB page-size acceptance still requires actual signed AAB and Android 16 device testing.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
