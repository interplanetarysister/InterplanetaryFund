# IFund — independent native mobile applications

These are **NEW**, independently packaged Capacitor apps for iOS and Android. Their React UI is bundled from the canonical `apps/web` source, and their account/campaign data and authorization remain on the shared live `interplanetaryfund.com` services. Neither package modifies, replaces, signs, or republishes the Base44 Android APK or its preserved package identity `com.base6a67a778342a8fe05ee79cba.app`.

## Architecture

- New iOS bundle ID and Android application ID: `com.interplanetaryfund.app` (confirm store availability before registering).
- Both platforms bundle the independently reviewed **`apps/web/dist-mobile`** locally, not a remote production WebView URL or the unfinished full website router. Supabase reads and authentication use the existing project `ssibsfmtodgximseeqsv`. The native-only `/api/*` adapter sends authenticated calls over HTTPS to canonical Cloudflare, which independently enforces authorization. There is no second database or ledger.
- Live records stay shared immediately after server writes. Changes to the bundled frontend or native code require a new signed app build and store submission; website UI updates alone do not update installed binaries.
- This bundled candidate is **not yet store-ready**: Apple App Review 4.2 requires real usefulness and on-device proof beyond a repackaged website. The dedicated mobile UI includes saved links, transparent on-device planning, native share, live campaign discovery, and privacy/safety controls. Device testing and signed app review still remain. The app must pass real device testing, secure auth/redirect/OAuth/payment/keyboard/deep-link flows, accessibility, native integration, content and finance compliance, signing, and store review.
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

**Native implementation:** `apps/web/src/lib/nativeApi.js` intercepts relative `/api/*` requests **only** within a bundled native WebView and routes them via CapacitorHttp to `https://interplanetaryfund.com`; browser/Supabase requests remain unchanged. It preserves user JWT headers, does not change server-side CORS policies or roles, and fails closed on native transport errors. Native campaign sharing uses the OS Share plugin and verified public IFund URLs. The initial store bundle does not expose blog/community publishing, finance, admin or paid subscriptions. Signup email links and recovery go to the public HTTPS callback; return to the app and sign in with password afterward. Native social OAuth is deliberately hidden until secure deep-link handling and Supabase redirect registration are independently verified. Native in-app financial checkout/capture writes are blocked pending app-store/provider policy review; read-only balances and cancellation remain possible where backend authorization permits. All these paths need device/hosted testing before claiming they work.

**Native public navigation:** `@capacitor/app` now registers a strict public-link handler for canonical HTTPS campaign, social post, blog, publication, Discover and Atlas routes. It rejects admin, authentication-token, and off-site links. A listener alone does NOT register app/universal links with iOS/Android: signed App Store team ID, Android release signing SHA-256, `apple-app-site-association`, `assetlinks.json`, and native platform entitlements/intent filters must be completed and independently verified before advertising tap-to-open app links. Do not publish association files using invented signing IDs.

The native verification script supports `--candidate` for compile-only structural checks and `--store` for a stricter fail-closed release gate. No blank `release-evidence.json` should be created to bypass that gate. Device and reviewer evidence must be independently established.

## Candidate artifacts and release isolation (November 15, 2026)

Both workflows are **manual-only** and operate on `apps/mobile` with
`com.interplanetaryfund.app`; neither uses the Base44 project or original
Android package ID. The canonical Supabase publishable key was checked against
the project's active public API keys and can be supplied by GitHub Actions
variables or the already-published public-key fallback. No server-only service
key is embedded in the native apps.

- `.github/workflows/ifund-native-android.yml` compiles an **installable debug APK** and an **unsigned release AAB**. The AAB cannot be submitted to Play without a separate verified release keystore; the debug APK must not be marketed as a Play Store release.
- `.github/workflows/ifund-native-ios.yml` requires **Xcode 26+**, compiles an unsigned iOS Simulator `.app`, and packages it as `IFund-iOS-Simulator.zip`. This is **not** an iPhone-installable IPA, TestFlight build, or App Store submission.
- The candidate workflows generate a dependency lockfile and attach it to the test artifacts. A reviewed lockfile must be committed before `--store` can succeed. Until the owner authorizes manual native builds, neither workflow has executed.
- `apps/web/src/components/native/NativeConnectivityBanner.jsx` reports offline/network failures in native packages without pretending server/ledger data has been cached. `nativeApi.js` supports request-abort responsiveness without claiming to cancel a native socket.
- Current outstanding store prerequisites include genuine Apple Developer and Google Play Console identities; independent signing artifacts; verified release app IDs; app/site association; public/user authentication acceptance; policy-compliant payments; actual iOS/Android device testing; and the website's complete route-release evidence.

## Scoped Apple / Play mobile app — current source

The first-release mobile bundle is built from `apps/web/src/mobile-main.jsx` using
`npm run build:mobile` and the deliberately separate `vite.mobile.config.js`.
Its entry page is `apps/web/mobile.html`, and `mobile.css` uses local system
fonts rather than external Google Fonts or the site builder's studio styles.
The scope manifest is `apps/mobile/ci/store-scope.json`.

The reviewed UI offers browse/discover, opt-in location labels, real published
campaign details, native share sheet, saved links containing only campaign IDs,
a *planning completeness* checklist that makes **no success prediction**,
owner-only campaign summary, email account access, and direct privacy controls.
It deliberately excludes payment and donation checkout, paid subscriptions,
withdrawals, automated social publishing and administrator features.

Mobile `/delete-account` now directly calls the authenticated,
idempotent `ifund_request_account_deletion` Supabase RPC, with an owner-scoped
status read and a separately authorized super-admin queue at
`/admin/deletions` on the canonical website. This is NOT automatic account
erasure. A reviewed processor must remove eligible member/content data,
address third-party processors and legitimate financial retention, and confirm
completion. Account creation is **not store acceptable** until that erasure
process and the public deletion URL are proven to work on the released site.
The backend migration is additive; it has not modified financial records.

The mobile `Browse without an account` path **does not create a Supabase anonymous user**. The canonical website's guest onboarding is unaffected. For any existing real Supabase anonymous session, the mobile deletion screen separately checks the authenticated JWT and allows a direct deletion request through the same protected request table. Anonymous unauthenticated public-role callers cannot request deletion of someone else's account.

The Help page submits verified support tickets directly and reads owner-scoped
request statuses; public mailto remains optional. Reports on campaigns use the
existing moderated support queue. Cross-device organizer blocking uses
`ifund_mobile_organizer_blocks` with RLS and verified block/unblock RPCs.
Disclosure, filtering, incident handling and moderation response times still
require live operational review, not source-only assumptions.

**External URL check (November 15, 2026):** `/privacy`, `/contact` and
`/delete-account` each returned HTTP 200 from Cloudflare. An SPA can return
HTTP 200 even without the intended React route. The new deletion React route
exists on the working branch, **not** on the current `main` revision, so the
external deletion page must not be called live/functional until its content is
tested on production. No production deployment was triggered by this mobile work.

## Store readiness checklist

1. Complete the entire current website route acceptance manifest (currently 82 patterns; refresh count), admin RBAC, real backend coverage, errors and mobile UX.
2. Verify mobile email/password login, signup confirmation on public HTTPS, password recovery, session persistence, error recovery, and account switching; implement and verify native app/universal links before enabling social OAuth.
3. Verify real iOS/Android OS share sheets, secure campaign/navigation deep links, and app-specific utility on devices; push notifications must be opt-in and server-authorized before enabling.
4. Audit Apple App Review 3.1 and 3.2, Play policies and PayPal terms for charity, personal monetary gifts, digital subscriptions and 7% withdrawal fee. Native payment writes are intentionally blocked for now; route any later external checkout only through a reviewed Safari/approved-provider flow with verified ledger records.
5. Provide privacy disclosure, account deletion path, support/contact, metadata, screenshots, age rating, and review account without leaking secrets.
6. Obtain independent signing identity, Apple Developer/App Store Connect authorization, Android release keystore, Play Console access; generate versioned signed IPA/AAB and distribute only after successful QA and provider approval.
7. Confirm no changes to the legacy Base44 APK or signing credentials.
