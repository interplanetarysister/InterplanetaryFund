# IFund — independent native mobile applications

These are **NEW** Capacitor projects for iOS and Android, using the canonical `interplanetaryfund.com` live application. Neither package modifies, replaces, signs, or republishes the Base44 Android APK or its preserved package identity `com.base6a67a778342a8fe05ee79cba.app`.

## Architecture

- New iOS bundle ID and Android application ID: `com.interplanetaryfund.app` (confirm store availability before registering).
- Both platforms load `https://interplanetaryfund.com` over HTTPS. This uses the *existing* live app, Supabase project `ssibsfmtodgximseeqsv`, auth, RLS, backend APIs, campaigns and ledger. No independent database, payment account, or data replication.
- Website updates affect the native shells' content immediately; device-specific native binary changes still need store submissions.
- This initial wrapper is **not yet store-ready**: Apple App Review 4.2 requires meaningful app-specific utility beyond a repackaged site. The app must pass real device testing, secure auth/redirect/OAuth/payment/keyboard/deep-link flows, accessibility, native integration, content and finance compliance, signing, and store review.
- A live-site dependency means users need network connectivity. The app does not claim offline writes or offline ledger access.
- Use separate bundle IDs and signing assets from Base44. Do **not** modify `apps/web/capacitor.config.json`, `apps/web/ANDROID_APP.md`, or the existing `.github/workflows/android-apk.yml` as part of this new mobile project.

## Build candidate (do not publish until web-route and financial release QA passes)

```sh
cd apps/web
npm ci --no-audit --no-fund
npm test
npm run build
cd ../mobile
npm install --no-audit --no-fund
npx cap add android
npx cap sync android
# Build and test Android in Android Studio (requires SDK/JDK).
# For iOS use macOS with Xcode:
npx cap add ios
npx cap sync ios
# Build and test in Xcode on actual devices.
```

The Capacitor `server.url` intentionally points to the canonical HTTPS production site for immediate shared-data parity, **not Base44**. Evaluate replacing this remote-webview approach with a bundled, native-integrated presentation before App Store submission. Do not submit a thin wrapper or claim iOS App Store acceptance based on this scaffolding.

## Native runtime and offline safety

The current `capacitor.config.json` is a **candidate-only connected-site test shell**. Capacitor's `server.url` property is explicitly documented as intended for development live reload and not for production distribution. Its purpose here is to exercise the canonical live app without any Base44 changes; do not ship this configuration to either store.

The `server.errorPath` entry loads `mobile-offline.html` from copied web assets on load failure. This fallback is accessible and read-only; it never caches financial balances or stages payment actions.

**Production architecture work required:** Bundle a built web frontend inside the native binary (no `server.url`), then make its authenticated API calls to the same `https://interplanetaryfund.com` Cloudflare Functions/Workers and canonical Supabase project with explicitly allowlisted native origins, approved deep-link callbacks, strict token storage/session handling, and native payment policy handling. Simply deleting `server.url` today would break relative `/api/*` calls and some OAuth redirects, so do not claim this has already been implemented. The website and mobile clients must share the same *database and server-side authorization*, not necessarily the same URL origin.

The native verification script supports `--candidate` for compile-only structural checks and `--store` for a stricter fail-closed release gate. No blank `release-evidence.json` should be created to bypass that gate. Device and reviewer evidence must be independently established.

## Store readiness checklist

1. Complete the 80-route website release gate, admin RBAC, real backend coverage, errors and mobile UX.
2. Verify login, signup, password recovery, OAuth return links and sessions across iOS/Android, web and app restarts; native app origin/cookie restrictions may require an auth bridge.
3. Add native-specific usefulness (e.g., authorized push notifications/deep links, secure sharing and platform-native campaign workflows) and on-device evidence, not just browser chrome.
4. Audit Apple App Review 3.1 and 3.2 for charitable fundraising, personal monetary gifts, subscription/digital offerings and 7% withdrawal fee. **Do not assume the current PayPal donation button is permissible inside iOS.** Use appropriate external Safari payment path or nonprofit/Apple Pay flow if confirmed applicable; retain server-side financial security.
5. Provide privacy disclosure, account deletion path, support/contact, metadata, screenshots, age rating, and review account without leaking secrets.
6. Obtain independent signing identity, Apple Developer/App Store Connect authorization, Android release keystore, Play Console access; generate versioned signed IPA/AAB and distribute only after successful QA and provider approval.
7. Confirm no changes to the legacy Base44 APK or signing credentials.
