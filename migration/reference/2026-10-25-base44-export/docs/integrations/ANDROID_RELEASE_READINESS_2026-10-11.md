# IFund Android / Firebase release readiness — October 11, 2026

## Current source and build
- Base44 app: `6a67a778342a8fe05ee79cba`, branch `main`, Cloudflare/custom-domain and Base44 data plane unchanged.
- Node 22.23.2 web build: PASS.
- Capacitor 8 Android project and Firebase `google-services.json`: configured for project `interplanetary-fund`, Android application ID `com.base6a67a778342a8fe05ee79cba.app`.
- Firebase Google Services Gradle, Firebase BoM and Crashlytics plugin: configured.
- `@capacitor/push-notifications@8.0.3` built with Android permission flow. User requests permission from Notifications screen. Push token registration goes through `registerPushDevice`, subject to verified Base44 identity; entity RLS admin-only.
- Crashlytics reporting is **off by default** in Android manifest; a native consent control can enable it. No Analytics or Firebase Auth user migration.
- Node test suite, financial contracts, OAuth source contracts, Gradle debug unit tests and debug APK build: PASS in build environment.
- Debug APK exists in build environment: `android/app/build/outputs/apk/debug/app-debug.apk` (~8.9 MB); debug-signed only, not Play release-signed.
- Target SDK API 36 matches Google Play's current new-app requirement for 2026.
- Current testing environment has no attached Android phone, no emulator and no KVM, so no device-dependent claims are verified.

## Not ready for Google Play submission — mandatory release blockers
1. **Native live-login test**: sign in with an existing IFund email/password account, verify `auth.me`, token persistence, sign-out, expired-session recovery and reset-password return. Native uses the canonical HTTPS Base44 backend and Capacitor's native HTTP bridge; the actual device behavior is not yet verified.
2. **Social sign-in**: Google / Apple / Facebook account login uses website redirect; the native app has no verified approved secure app callback and browser-to-app one-time-token exchange. Do NOT publish until existing social-login users can sign in without losing account continuity. Never pass bearer tokens in deep links or URL query strings.
3. **Browser-only consent flows**: external platform OAuth, PayPal donation checkouts, uploads, file chooser, page navigation and supported deep links need on-device QA. `OAuthConsent.jsx` contains local-origin paths which are not assured to work in Android WebView.
4. **Push sending**: Firebase Messaging registration code exists, but no privileged Firebase HTTP v1 sender credential / IAM connection or tested notification dispatcher is in place. Verify the new `PushDevice` entity and `registerPushDevice` backend are actually deployed before presenting push as fully functional; enforce generic notification payloads, no donor or account secrets.
5. **Crash telemetry**: verify user opt-in/out and Crashlytics receipt on a test device, with privacy notice and Play data-safety declaration. No telemetry is assumed collected merely because SDK is built.
6. **App signing and distribution**: configure long-term signing and Google Play App Signing, create an Android App Bundle (AAB), audit icons/splash accessibility, privacy, Play Data Safety, permissions, target API and app-specific account deletion links.
7. **Package name decision**: current `com.base6a67a778342a8fe05ee79cba.app` matches existing Firebase config and the built APK. If the desired Play package is branded `com.interplanetaryfund.app`, it must be registered as a *new Android app* in the SAME Firebase project, and every Android app ID and google-services.json updated **before first Play upload**. A Play package ID cannot be changed afterwards.
8. **Backend deployment**: source changes in Base44 are not proof that server functions/entities or the public website have been deployed. Verify live availability separately; do not deploy the website as part of Android setup.

## Release plan
- Obtain a physical Android device or a fully working Android emulator; test standard and social login with non-admin and admin test accounts, preserving Base44 identity.
- Test navigation, social publishing, donation and withdrawal protections using test transactions, data retrieval, scrolling, network failures, link routing and accessibility.
- Verify Firebase console Crashlytics and FCM test notifications; connect least-privilege sender credentials through server-only secrets (never public `VITE_*` values or the repository).
- Fix any test failures and repeat regression tests.
- Only after all gates pass, prepare a signed AAB and Google Play closed/internal test release. Do not submit or publish automatically.

## Stable rollback
All work is additive to the native Android project and Android-only conditionals; existing web hosting, Firebase Hosting, Base44 users, and primary payment ledger remain unchanged. Turn off Android distribution to roll back, rather than touching the current production website.
