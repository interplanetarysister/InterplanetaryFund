# IFund — independent native mobile applications

These are **NEW**, independently packaged Capacitor apps for iOS and Android. Their React UI is bundled from the canonical `apps/web` source, and their account/campaign data and authorization remain on the shared live `interplanetaryfund.com` services. Neither package modifies, replaces, signs, or republishes the Base44 Android APK or its preserved package identity `com.base6a67a778342a8fe05ee79cba.app`.

## Architecture

- New iOS bundle ID and Android application ID: `com.interplanetaryfund.app` (confirm store availability before registering).
- Both platforms bundle `apps/web/dist` locally, not a remote production WebView URL. Supabase reads and authentication use the existing project `ssibsfmtodgximseeqsv`. The native-only `/api/*` adapter sends authenticated calls over HTTPS to canonical Cloudflare, which independently enforces authorization. There is no second database or ledger.
- Live records stay shared immediately after server writes. Changes to the bundled frontend or native code require a new signed app build and store submission; website UI updates alone do not update installed binaries.
- This bundled app is **not yet store-ready**: Apple App Review 4.2 requires meaningful app-specific utility beyond a repackaged site. It now integrates native sharing and an offline recovery screen, but more device-tested native features and full site acceptance are still required. The app must pass real device testing, secure auth/redirect/OAuth/payment/keyboard/deep-link flows, accessibility, native integration, content and finance compliance, signing, and store review.
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

Both native binaries bundle the website's built React assets instead of relying on the development-only `server.url`. Runtime API requests use the canonical Cloudflare HTTPS transport; Supabase uses the existing live project. These candidates still need real-device testing, secure native OAuth deep links, verified financial restrictions, native-specific utility review and store signing before distribution.

## Native runtime and offline safety

The current `capacitor.config.json` serves `apps/web/dist` via the secure local Capacitor WebView origin (`capacitor://localhost` on iOS, `https://localhost` on Android). It does not load the site with a development `server.url`. The UI still requires live connectivity for current campaign/member data; no financial records are cached offline.

The `server.errorPath` entry loads `mobile-offline.html` from copied web assets on load failure. This fallback is accessible and read-only; it never caches financial balances or stages payment actions.

**Native implementation:** `apps/web/src/lib/nativeApi.js` intercepts relative `/api/*` requests **only** within a bundled native WebView and routes them via CapacitorHttp to `https://interplanetaryfund.com`; browser/Supabase requests remain unchanged. It preserves user JWT headers, does not change server-side CORS policies or roles, and fails closed on native transport errors. Native campaign/blog/community sharing uses the OS Share plugin and verified public IFund URLs. Signup email links and recovery go to the public HTTPS callback; return to the app and sign in with password afterward. Native social OAuth is deliberately hidden until secure deep-link handling and Supabase redirect registration are independently verified. Native in-app financial checkout/capture writes are blocked pending app-store/provider policy review; read-only balances and cancellation remain possible where backend authorization permits. All these paths need device/hosted testing before claiming they work.

**Native public navigation:** `@capacitor/app` now registers a strict public-link handler for canonical HTTPS campaign, social post, blog, publication, Discover and Atlas routes. It rejects admin, authentication-token, and off-site links. A listener alone does NOT register app/universal links with iOS/Android: signed App Store team ID, Android release signing SHA-256, `apple-app-site-association`, `assetlinks.json`, and native platform entitlements/intent filters must be completed and independently verified before advertising tap-to-open app links. Do not publish association files using invented signing IDs.

The native verification script supports `--candidate` for compile-only structural checks and `--store` for a stricter fail-closed release gate. No blank `release-evidence.json` should be created to bypass that gate. Device and reviewer evidence must be independently established.

## Store readiness checklist

1. Complete the 80-route website release gate, admin RBAC, real backend coverage, errors and mobile UX.
2. Verify mobile email/password login, signup confirmation on public HTTPS, password recovery, session persistence, error recovery, and account switching; implement and verify native app/universal links before enabling social OAuth.
3. Verify real iOS/Android OS share sheets, secure campaign/navigation deep links, and app-specific utility on devices; push notifications must be opt-in and server-authorized before enabling.
4. Audit Apple App Review 3.1 and 3.2, Play policies and PayPal terms for charity, personal monetary gifts, digital subscriptions and 7% withdrawal fee. Native payment writes are intentionally blocked for now; route any later external checkout only through a reviewed Safari/approved-provider flow with verified ledger records.
5. Provide privacy disclosure, account deletion path, support/contact, metadata, screenshots, age rating, and review account without leaking secrets.
6. Obtain independent signing identity, Apple Developer/App Store Connect authorization, Android release keystore, Play Console access; generate versioned signed IPA/AAB and distribute only after successful QA and provider approval.
7. Confirm no changes to the legacy Base44 APK or signing credentials.
