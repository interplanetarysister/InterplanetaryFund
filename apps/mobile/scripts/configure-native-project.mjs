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

// Attach signing entitlements in both generated iOS target configurations.
// An App.entitlements file not referenced by CODE_SIGN_ENTITLEMENTS has no
// effect on signed associated domains, so refuse ambiguous Xcode projects.
export function addIosSigningEntitlements(pbxproj) {
  if (typeof pbxproj !== "string" ||
      !pbxproj.includes("/* Begin XCBuildConfiguration section */")) {
    throw new Error("Unknown Xcode project: cannot attach Associated Domains.");
  }
  const entitlements = "CODE_SIGN_ENTITLEMENTS = App/App.entitlements;";
  if (pbxproj.includes(entitlements)) {
    const count = pbxproj.split(entitlements).length - 1;
    if (count !== 2) throw new Error("Incomplete Xcode entitlement configuration.");
    return pbxproj;
  }
  if (/CODE_SIGN_ENTITLEMENTS\s*=/.test(pbxproj)) {
    throw new Error("An unexpected signing entitlement is already configured.");
  }
  // Match only the generated App target's two build configurations.
  // The regular expression stops at the next configuration boundary.
  const pattern = /\/\* (?:Debug|Release) \*\/ = \{[\s\S]*?\n\s*\};/g;
  const blocks = [...pbxproj.matchAll(pattern)].map(match => match[0])
    .filter(block => block.includes("isa = XCBuildConfiguration;") &&
      block.includes("PRODUCT_BUNDLE_IDENTIFIER = com.interplanetaryfund.app;"));
  if (blocks.length !== 2 || !blocks.every(block => block.includes("CODE_SIGN_STYLE = Automatic;")))
    throw new Error("Unable to identify both App target signing configurations.");
  let output = pbxproj;
  for (const block of blocks) {
    const updated = block.replace("CODE_SIGN_STYLE = Automatic;",
      entitlements + "\n\t\t\t\tCODE_SIGN_STYLE = Automatic;");
    output = output.replace(block, updated);
  }
  return output;
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
  // Writing an entitlements file alone does not attach it to the Xcode app
  // target. Patch the existing App target build configurations fail-closed.
  const project = resolve(targetRoot, "ios/App/App.xcodeproj/project.pbxproj");
  if (!existsSync(project)) throw new Error("Generated iOS Xcode project not found.");
  const projectText = readFileSync(project, "utf8");
  const configured = addIosSigningEntitlements(projectText);
  if (configured !== projectText) writeFileSync(project, configured);
  return path;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log("Configured independent IFund native links:", configure(process.argv[2])); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
