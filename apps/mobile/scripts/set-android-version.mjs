#!/usr/bin/env node
// Produce a monotonic, reviewable Android versionCode for the new package only.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export function setAndroidVersion(source, buildNumber, versionName) {
  const code = Number(buildNumber);
  if (!Number.isSafeInteger(code) || code < 1 || code >= 2100000000)
    throw new TypeError("A valid positive Android release versionCode is required.");
  if (!/^\d+\.\d+\.\d+$/.test(String(versionName)))
    throw new TypeError("An explicit semantic release version is required.");
  const matchesCode = source.match(/\bversionCode\s+\d+/g) || [];
  const matchesName = source.match(/\bversionName\s+"[^"]+"/g) || [];
  if (matchesCode.length !== 1 || matchesName.length !== 1)
    throw new Error("Unexpected Android Gradle template; do not guess release version settings.");
  return source.replace(/\bversionCode\s+\d+/, "versionCode " + code)
    .replace(/\bversionName\s+"[^"]+"/, 'versionName "' + versionName + '"');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const cfg = JSON.parse(readFileSync(resolve(root, "capacitor.config.json"), "utf8"));
    if (cfg.appId !== "com.interplanetaryfund.app")
      throw new Error("Refusing to version the legacy Base44 APK.");
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    const gradle = resolve(root, "android/app/build.gradle");
    const next = setAndroidVersion(readFileSync(gradle, "utf8"), process.argv[2], pkg.version);
    writeFileSync(gradle, next);
    console.log("New independent Android package versioned for signed candidate.");
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
