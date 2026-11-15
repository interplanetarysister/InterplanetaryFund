#!/usr/bin/env node
/**
 * Creates reviewable Apple and Android association files from independently
 * verified store signing identities. Does NOT publish them to Cloudflare.
 *
 * Input:
 *   IFUND_APPLE_TEAM_ID = actual 10-char team ID in Apple Developer
 *   IFUND_ANDROID_APP_SIGNING_SHA256 = Google Play app-signing SHA256 cert
 * These are public identifiers, but must be verified against the real accounts.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOMAIN = "interplanetaryfund.com";
const PATHS = [
  "/", "/discover", "/atlas", "/campaign/*", "/social/post/*",
  "/blogs/*", "/publications/*", "/auth/callback", "/reset-password",
];
export function generateAssociations({ teamId, fingerprint, appId }) {
  if (!/^[A-Z0-9]{10}$/.test(String(teamId || "")) ||
      /^(.)\1{9}$/.test(String(teamId)))
    throw new Error("A verified, non-placeholder Apple Developer Team ID is required.");
  const sha = String(fingerprint || "").toUpperCase();
  if (!/^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(sha) ||
      /^00(?::00){31}$/.test(sha))
    throw new Error("A verified Google Play app-signing SHA-256 fingerprint is required.");
  if (appId !== "com.interplanetaryfund.app")
    throw new Error("Refusing to associate the Base44 APK or any other application.");
  return {
    apple: {
      applinks: {
        apps: [],
        details: [{ appID: teamId + "." + appId, paths: PATHS }],
      },
    },
    android: [{
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: appId,
        sha256_cert_fingerprints: [sha],
      },
    }],
  };
}

export function writeAssociations(values, output = resolve(root, "release-associations")) {
  const config = JSON.parse(readFileSync(resolve(root, "capacitor.config.json"), "utf8"));
  const files = generateAssociations({ ...values, appId: config.appId });
  const dest = resolve(output, ".well-known");
  mkdirSync(dest, { recursive: true });
  writeFileSync(resolve(dest, "apple-app-site-association"),
    JSON.stringify(files.apple, null, 2) + "\n");
  writeFileSync(resolve(dest, "assetlinks.json"),
    JSON.stringify(files.android, null, 2) + "\n");
  return dest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const path = writeAssociations({
      teamId: process.env.IFUND_APPLE_TEAM_ID,
      fingerprint: process.env.IFUND_ANDROID_APP_SIGNING_SHA256,
    });
    console.log("Association files prepared for independent inspection (NOT deployed):", path);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
