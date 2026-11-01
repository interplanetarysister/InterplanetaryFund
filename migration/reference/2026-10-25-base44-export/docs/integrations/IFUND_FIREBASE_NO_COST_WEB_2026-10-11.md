# IFund Firebase no-cost integration — October 11, 2026

## What was added in source
- **Optional Google Analytics for Web:** modular Firebase Web SDK initialized only after the visitor opts in via Notifications. Automatic page-view reports and advertising personalization are disabled. No IFund account identifier, donation value, campaign identifier, custom event or payment record is passed by our integration.
- **Optional Firebase Performance Monitoring (web):** initialized on the same explicit browser preference. This SDK can collect technical network URL paths and timing metrics; keep the privacy policy accurate. Both automatic and manual instrumentation can be turned off from the same control.
- **Android Crashlytics consent and Android FCM device registration** already exist in the Android app. These are not changed or duplicated by the web integration. Firebase push *delivery* still needs verified sender credentials and device testing.
- SDK imports for web Analytics and Performance are dynamic and do not load until consent. No new Hosting, Auth, Firestore, Storage, Functions or billing is configured.

## Critical: two different Firebase projects
The newly supplied **Web** SDK config identifies Firebase project **interplanetaryfund** and app ID **1:149740266464:web:d600f43383273bbb5b4185**. The existing Android `google-services.json` identifies a different Firebase project: **interplanetary-fund**.

These are NOT alternate spellings of the same project. Both configurations are intentionally kept intact. Android is not migrated, and the web config is used only for web diagnostics. Verify in Firebase Console that both projects belong to the owner and decide whether a later *planned migration* is worthwhile; never replace Android's google-services.json with a Web config.

## No-cost-first limits (checked October 11, 2026)
- Firebase lists Analytics, Performance Monitoring, Crashlytics, Cloud Messaging, App Distribution and In-App Messaging as no-cost products on Spark. SDK downloads are free, but some features may require console setup, privacy controls, domain/app verification and device QA.
- Firebase Remote Config is **not unrestricted free anymore**: since September 1, 2026, it includes **up to 100,000 fetch requests per day per project** at no charge, with above-quota usage billable on Blaze. Leave automatic Remote Config polling disabled. If introduced, apply a global budget and rate limits, not just a per-device cache.
- App Check itself is no-cost subject to the chosen attestation provider's quota. Do not enable App Check enforcement until the Base44 auth + API flow is tested. No App Check provider registration was supplied.
- Do not enable Firebase Hosting, App Hosting, Firestore, Cloud Storage, Cloud Functions, phone auth or Blaze billing as part of this work. These products may have no-cost quotas but can have charges or service cutoffs depending on plan/usage.
- Do not connect a billing account, enable Blaze, or authorize infrastructure changes without separate owner approval. The project plan/billing status has not been verified through Console.

## Release and privacy gates
1. Confirm this Web app exists in project `interplanetaryfund`, and confirm its Google Analytics property is enabled; code is configured but console data receipt is not yet verified.
2. Review/ship a web privacy notice explaining Google Analytics/Performance collection and browser preference. Analytics cookies/data may remain after opt-out according to Google retention policy; no claim of deletion is made.
3. On the published website, verify default-off behavior in a fresh browser, enable from Notifications, verify Analytics + Performance data appears in **the Web project**, and turn them off again. Confirm no event leaks donation or account values and no network requests to Firebase before consent.
4. Test site login/register/password reset, PayPal receipts, campaign totals, WebView behavior, Android login and existing Google Services Gradle build separately. Do not publish automatically.
5. Run `node scripts/verify-firebase-no-cost-web.mjs`, `npm run build`, `npm run verify:android-firebase`, and `npm run verify:analytics-safety` before release.

## Rollback
Remove the `installOptionalWebDiagnostics()` call from `src/main.jsx` to suspend new web diagnostics without affecting Base44 users or Firebase Android setup. A missing/blocked Firebase SDK must never block rendering, authentication or payment accounting.

## Reference
- https://firebase.google.com/pricing
- https://firebase.google.com/docs/remote-config/pricing
- https://firebase.google.com/docs/reference/js/analytics
- https://firebase.google.com/docs/perf-mon/disable-sdk?platform=web
