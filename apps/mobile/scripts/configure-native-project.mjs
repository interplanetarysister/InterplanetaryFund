#!/usr/bin/env node
/**
 * Apply independent IFund App Links / Universal Links capabilities to a fresh
 * Capacitor iOS or Android project. This script does not publish domain
 * associations, change the website or edit the legacy Base44 Android app.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOMAIN = "interplanetaryfund.com";
const PATHS = [
  ["/", "path"], ["/discover", "path"], ["/atlas", "path"],
  ["/campaign/", "pathPrefix"], ["/social/post/", "pathPrefix"],
  ["/blogs/", "pathPrefix"], ["/publications/", "pathPrefix"],
  ["/auth/mobile-callback", "path"],
];
const START = "<!-- IFUND_ASSOCIATED_APP_LINKS_BEGIN -->";
const END = "<!-- IFUND_ASSOCIATED_APP_LINKS_END -->";

export function addAndroidAppLinks(xml) {
  if (typeof xml !== "string" || !xml.includes("<manifest") ||
      !xml.includes('xmlns:android=') || !xml.includes("<activity"))
    throw new Error("Unexpected AndroidManifest.xml: refuse to edit.");
  if (xml.includes(START)) return xml;
  const activity = xml.indexOf("<activity");
  const close = xml.indexOf("</activity>", activity);
  if (close < 0) throw new Error("No Android activity closing tag: refuse to edit.");
  const filters = PATHS.map(([path, kind]) => `    <intent-filter android:autoVerify="true">
      <action android:name="android.intent.action.VIEW" />
      <category android:name="android.intent.category.DEFAULT" />
      <category android:name="android.intent.category.BROWSABLE" />
      <data android:scheme="https" android:host="${DOMAIN}" android:${kind}="${path}" />
    </intent-filter>`).join("\n");
  return xml.slice(0, close) +
    "    " + START + "\n" + filters + "\n    " + END + "\n    " +
    xml.slice(close);
}

export function iosEntitlements() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.developer.associated-domains</key>
  <array><string>applinks:${DOMAIN}</string></array>
</dict>
</plist>
`;
}

export function configure(platform, targetRoot = root) {
  if (!["android", "ios"].includes(platform))
    throw new TypeError("Choose exactly android or ios.");
  const config = JSON.parse(readFileSync(resolve(targetRoot, "capacitor.config.json"), "utf8"));
  if (config.appId !== "com.interplanetaryfund.app")
    throw new Error("Refusing to change any app other than the new iFund mobile identity.");
  if (platform === "android") {
    const path = resolve(targetRoot, "android/app/src/main/AndroidManifest.xml");
    if (!existsSync(path)) throw new Error("Generate the separate Android Capacitor project first.");
    const original = readFileSync(path, "utf8");
    writeFileSync(path, addAndroidAppLinks(original));
    return path;
  }
  const path = resolve(targetRoot, "ios/App/App/App.entitlements");
  if (!existsSync(dirname(path))) throw new Error("Generate the separate iOS Capacitor project first.");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, iosEntitlements());
  return path;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log("Configured independent IFund native links:", configure(process.argv[2])); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
