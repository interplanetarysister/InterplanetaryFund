#!/usr/bin/env node
// Read-only mobile release checks. Never touches the legacy Base44 app.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(root, "../..");
const read = path => readFileSync(resolve(repo, path), "utf8");
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const mode = process.argv[2] || "--candidate";
if (!["--candidate", "--store"].includes(mode)) {
  console.error("Usage: node apps/mobile/scripts/verify-mobile.mjs [--candidate|--store]");
  process.exit(2);
}

const config = JSON.parse(read("apps/mobile/capacitor.config.json"));
const legacy = JSON.parse(read("apps/web/capacitor.config.json"));
const pkg = JSON.parse(read("apps/mobile/package.json"));
assert(config.appId === "com.interplanetaryfund.app", "Independent application ID must match the new mobile package");
assert(legacy.appId === "com.base6a67a778342a8fe05ee79cba.app", "Legacy Base44 identity changed: stop");
assert(config.appId !== legacy.appId, "Native package must not overwrite Base44");
assert(!Object.hasOwn(config.server || {}, "url"), "Store candidate may not use a remote development server.url");
assert(config.server?.hostname === "localhost", "Native bundle must serve assets from local Capacitor origin");
assert(config.server?.iosScheme === "capacitor", "iOS native scheme must be fixed");
assert(config.server?.androidScheme === "https", "Android secure scheme must be fixed");
assert(config.webDir === "../web/dist-mobile", "Both native packages must bundle the independent store-reviewed UI");
assert(config.plugins?.CapacitorHttp?.enabled === false,
  "Use scoped API requests, not a global native HTTP override");
const apiTransport = read("apps/web/src/lib/nativeApi.js");
assert(apiTransport.includes('export const IFUND_API_ORIGIN = "https://interplanetaryfund.com"'),
  "Native API origin must be canonical");
assert(apiTransport.includes("export function installNativeApiTransport"),
  "Native API origin adapter must be installed");
assert(read("apps/web/src/main.jsx").includes("installNativeApiTransport()"),
  "Web app entrypoint must install native API transport before rendering");
assert(config.server?.cleartext === false, "Cleartext HTTP must remain disabled");
assert(config.server?.errorPath === "mobile-offline.html", "Native app must provide an offline recovery screen");
assert(existsSync(resolve(repo, "apps/web/public/mobile-offline.html")), "Offline screen is missing from the copied web assets");
const offlineScreen = read("apps/web/public/mobile-offline.html");
assert(offlineScreen.includes('href="/"'), "Offline recovery must return to the bundled app origin");
assert(!offlineScreen.includes('href="https://interplanetaryfund.com/"'),
  "Offline recovery must not replace the native shell with the remote website");
assert(offlineScreen.includes("env(safe-area-inset-top)") && offlineScreen.includes("env(safe-area-inset-bottom)"),
  "Native recovery screen must respect iPhone/Android safe areas");
assert(offlineScreen.includes("@media(max-width:360px)"),
  "Native recovery screen must remain readable on 320px devices");
assert(config.android?.allowMixedContent === false, "Android mixed content must remain disabled");
assert(!!pkg.dependencies?.["@capacitor/ios"] && !!pkg.dependencies?.["@capacitor/android"], "Both native platforms are required");
assert(pkg.dependencies?.["@capacitor/share"] === "8.0.3", "Native system-share plugin is required");
assert(pkg.dependencies?.["@capacitor/app"] === "8.1.2", "Native public app-link plugin is required");
assert(read("apps/web/src/main.jsx").includes("<NativeConnectivityBanner />"),
  "Native offline/recovery banner must be mounted");
assert(read("apps/web/src/main.jsx").includes("installNativePublicLinks()"),
  "Native public link listeners must install before React mounts");
assert(read("apps/web/src/lib/nativeLinks.js").includes("safeNativePublicRoute"),
  "Native public deep links must be validated before routing");
assert(pkg.devDependencies?.["@capacitor/assets"] === "4.0.0", "Brand asset generation must be pinned");
assert(read("apps/mobile/assets/icon.svg") === read("apps/web/assets/icon.svg"),
  "Native icon must be the canonical IFund brand art, not the Base44 app");
assert(apiTransport.includes('registerPlugin("Share")'), "Native share bridge missing");
const nativeProfile = read("apps/web/src/lib/memberProfile.js");
const nativeAvatar = read("apps/web/src/lib/nativeAvatar.js");
assert(nativeProfile.includes("nativeAvatarRequest(url, request)"),
  "Native profile image uploader must use bounded authenticated binary transport");
assert(nativeAvatar.includes('"/api/profile/avatar"') &&
  nativeAvatar.includes("MAX_AVATAR_BYTES"),
  "Native avatar endpoint and 2MB binary limits must remain enforced");
assert(read("apps/web/src/lib/nativeOAuth.js").includes("redirect.pathname !== MOBILE_AUTH_CALLBACK"),
  "Native social OAuth must require a verified mobile PKCE return route");
assert(read("apps/web/src/components/auth/OAuthButtons.jsx").includes("VITE_NATIVE_APPLE_SIGNIN_READY"),
  "iOS social login must remain gated on approved Sign in with Apple");
assert(read("apps/web/src/pages/Profile.jsx").includes("/support?request=delete-account"),
  "Members must be able to initiate a tracked deletion request inside the app");
assert(read("apps/web/src/components/campaigns/CampaignShareButton.jsx").includes("shareWithDevice("),
  "Campaign share sheet is not integrated with native sharing");

for (const name of ["android", "ios"]) {
  const workflow = read(".github/workflows/ifund-native-" + name + ".yml");
  assert(/workflow_dispatch:/.test(workflow), name + " native build must remain manually triggered");
  assert(!/^\s+(push|pull_request):/m.test(workflow), name + " native build must not auto-trigger");
  assert(workflow.includes("com.interplanetaryfund.app"), name + " workflow lacks independent identity assertion");
}

// The mobile store application is independently scoped. An incomplete
// administrator-only website route must never be disguised as mobile QA,
// nor should it unnecessarily prevent preparing the reviewed mobile binary.
const scope = JSON.parse(read("apps/mobile/ci/store-scope.json"));
const mobileSource = read("apps/web/src/MobileStoreApp.jsx");
const mobileEntrypoint = read("apps/web/src/mobile-main.jsx");
const mobileBuild = read("apps/web/vite.mobile.config.js");
assert(scope.schema_version === 1 && scope.app_id === config.appId,
  "Mobile store review scope must use the independent application identity");
assert(Array.isArray(scope.routes) && scope.routes.length >= 15, "Store route scope is missing");
assert(scope.output_dir === "apps/web/dist-mobile", "Store build must be independent");
const missingMobileRoutes = scope.routes.filter(route =>
  !mobileSource.includes('<Route path="' + route + '"')
);
assert(missingMobileRoutes.length === 0,
  "Unregistered store routes: " + missingMobileRoutes.join(", "));
for (const route of scope.excluded_routes || []) {
  assert(!mobileSource.includes('<Route path="' + route + '"'),
    "Store build includes an unreviewed website feature: " + route);
}
assert(!mobileSource.includes('import App from "@/App"') &&
  !mobileSource.includes('import App from "./App"'),
  "Native store binary must not bundle the full website router");
assert(mobileEntrypoint.includes("MobileStoreApp") &&
  mobileEntrypoint.includes("installNativeApiTransport()"),
  "Store entrypoint must load scoped, connected app");
assert(mobileBuild.includes("publicDir: false") &&
  mobileBuild.includes('renameSync(generated, resolve(out, "index.html"))'),
  "Store build must have local index and not copy unrelated public web archives");
assert(read("apps/web/src/mobile/MobileStoreDeleteAccount.jsx").includes("requestAccountDeletion(") &&
  read("apps/web/src/lib/accountDeletion.js").includes('client.rpc("ifund_request_account_deletion")') &&
  read("apps/web/src/lib/accountDeletion.js").includes('client.rpc("ifund_my_account_deletion_requests")') &&
  read("apps/web/src/pages/DeleteAccount.jsx").includes("MobileStoreDeleteAccount"),
  "Mobile and public website must use the dedicated, verified self-service deletion process");
assert(read("apps/web/src/mobile/MobileStoreCampaign.jsx").includes("ifund_create_support_ticket"),
  "UGC reports must be submitted to the real canonical support moderation queue");
assert(read("apps/web/src/mobile/MobileStoreCampaign.jsx").includes("shareWithDevice"),
  "Native campaign sharing must use the OS share sheet");
assert(read("apps/web/src/mobile/organizerBlock.js").includes("ifund_mobile_block_organizer") &&
  read("apps/web/src/mobile/organizerBlock.js").includes("ifund_mobile_unblock_organizer") &&
  read("apps/web/src/mobile/MobileStoreAccount.jsx").includes("await unblockOrganizer(id)") &&
  read("apps/web/src/mobile/MobileStoreCampaign.jsx").includes("await blockOrganizer(organizerId)"),
  "Native organizer blocking must be canonical, account-scoped, confirmed and revocable");
assert(read("apps/web/src/mobile/MobileStoreSaved.jsx").includes("blockedOrganizerIds()") &&
  read("apps/web/src/mobile/MobileStoreDiscover.jsx").includes("blockedOrganizerIds()"),
  "All native campaign feeds must honor account-scoped organizer blocking");
assert(read("apps/web/src/mobile/MobileStoreHelp.jsx").includes('client.rpc("ifund_create_support_ticket"') &&
  read("apps/web/src/mobile/MobileStoreHelp.jsx").includes("ticket_id"),
  "Native support must record a verified ticket without relying solely on email");

assert(read("apps/web/src/mobile/MobileReadiness.jsx").includes("not") &&
  read("apps/web/src/mobile/MobileReadiness.jsx").includes("prediction"),
  "Planning checklist must not claim to predict fundraising success");
const unfinished = missingMobileRoutes.length;
if (mode === "--store") {
  assert(existsSync(resolve(root, "package-lock.json")),
    "A reviewed, committed native dependency lockfile is required before a signed store release");
  assert(unfinished === 0, "A reviewed mobile route is not registered");
  const approval = resolve(root, "release-evidence.json");
  assert(existsSync(approval), "Store release requires independent evidence file, signed artifact and provider compliance review");
  // Evidence must be independently reviewed even when this file eventually exists.
  if (existsSync(approval)) {
    const evidence = JSON.parse(readFileSync(approval, "utf8"));
    for (const key of ["ios_device_passed", "android_device_passed", "email_password_auth_passed", "privacy_review_passed", "fundraising_policy_review_passed", "reviewer_approved", "mobile_scope_e2e_passed", "ugc_moderation_passed", "account_deletion_passed", "google_api_36_passed", "android_16kb_passed", "store_metadata_complete"]) {
      assert(evidence[key] === true, key + " not independently verified");
    }
    assert(evidence.schema_version === 1, "Unsupported store acceptance evidence schema");
    assert(typeof evidence.tested_commit === "string" &&
      /^[0-9a-f]{40}$/i.test(evidence.tested_commit) &&
      !!process.env.GITHUB_SHA &&
      evidence.tested_commit.toLowerCase() === process.env.GITHUB_SHA.toLowerCase(),
      "Store evidence must cover the EXACT current GitHub commit and cannot be reused from an earlier version");
    const verifiedAt = Date.parse(evidence.verified_at);
    assert(Number.isFinite(verifiedAt) && verifiedAt <= Date.now() + 300000 &&
      verifiedAt >= Date.now() - 30 * 86400000,
      "Store evidence must be dated within the last 30 days");
    assert(typeof evidence.approved_by === "string" && evidence.approved_by.trim().length >= 3,
      "Independent QA reviewer identity is missing");
    for (const key of ["ios_device", "android_device", "email_password_auth",
      "privacy_review", "fundraising_policy_review", "mobile_scope_e2e", "ugc_moderation", "account_deletion", "google_api_36", "android_16kb", "store_metadata"]) {
      let valid = false;
      try {
        const url = new URL(evidence.evidence_urls?.[key] || "");
        valid = url.protocol === "https:" && !url.username && !url.password &&
          !["localhost", "127.0.0.1"].includes(url.hostname);
      } catch { /* Missing/non-HTTPS evidence must not authorize a release. */ }
      assert(valid, "Missing independently reviewable HTTPS evidence: " + key);
    }
  }
}
if (errors.length) {
  console.error("IFund mobile " + mode + " blocked:\n - " + errors.join("\n - "));
  process.exit(1);
}
console.log("IFund mobile " + mode + " structural checks passed; " +
  unfinished + " mobile store routes are missing from source. " +
  "Candidate compilation is NOT store or live-service certification.");
