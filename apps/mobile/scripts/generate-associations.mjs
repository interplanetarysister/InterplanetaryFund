#!/usr/bin/env node
/**
 * Generate publication-ready App Links / Universal Links association JSON.
 * No placeholder team ID, invented certificate, or unverified auth callback.
 * Output is local release evidence only: never deploy files automatically.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const APP_ID = "com.interplanetaryfund.app";
export const PUBLIC_PATHS = Object.freeze([
  "/", "/discover", "/atlas", "/campaign/*",
  "/social/post/*", "/blogs/*", "/publications/*",
]);

export function normalizeAndroidFingerprint(value) {
  const raw = String(value || "").trim();
  const hex = raw.replace(/:/g, "").toUpperCase();
  if (!/^[0-9A-F]{64}$/.test(hex)) throw new Error("A genuine Android release signing SHA-256 fingerprint is required.");
  return hex.match(/.{2}/g).join(":");
}

export function generateAssociations({ appleTeamId, androidFingerprint, authVerified = false }) {
  const team = String(appleTeamId || "").trim();
  if (!/^[A-Z0-9]{10}$/.test(team)) throw new Error("Apple team ID must be 10 uppercase letters/digits from App Store Connect.");
  const fingerprint = normalizeAndroidFingerprint(androidFingerprint);
  if (typeof authVerified !== "boolean") throw new TypeError("Auth verification flag must be boolean.");
  const paths = [...PUBLIC_PATHS, ...(authVerified ? ["/auth/mobile-callback"] : [])];
  return {
    apple: {
      applinks: {
        details: [{
          appIDs: [team + "." + APP_ID],
          components: paths.map(path => ({
            "/": path,
            comment: path === "/auth/mobile-callback"
              ? "Native auth acceptance passed; never authorize token-bearing generic routes."
              : "Public IFund content",
          })),
        }],
      },
    },
    android: [{
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: APP_ID,
        sha256_cert_fingerprints: [fingerprint],
      },
    }],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const appleTeamId = process.env.IFUND_APPLE_TEAM_ID;
  const androidFingerprint = process.env.IFUND_ANDROID_RELEASE_CERT_SHA256;
  const authVerified = process.env.IFUND_NATIVE_AUTH_E2E_VERIFIED === "true";
  try {
    const pair = generateAssociations({ appleTeamId, androidFingerprint, authVerified });
    const dest = resolve(dirname(fileURLToPath(import.meta.url)), "../build/associations");
    mkdirSync(resolve(dest, ".well-known"), { recursive: true });
    writeFileSync(resolve(dest, ".well-known/apple-app-site-association"),
      JSON.stringify(pair.apple, null, 2) + "\n");
    writeFileSync(resolve(dest, ".well-known/assetlinks.json"),
      JSON.stringify(pair.android, null, 2) + "\n");
    console.log("Generated non-deployed association candidates in apps/mobile/build/associations");
  } catch (error) {
    console.error("Association generation blocked: " + error.message);
    process.exitCode = 1;
  }
}
