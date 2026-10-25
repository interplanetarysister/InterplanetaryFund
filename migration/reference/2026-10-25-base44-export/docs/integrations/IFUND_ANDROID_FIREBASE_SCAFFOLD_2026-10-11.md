# IFund Android + Firebase scaffold — 2026-10-11

## Verified changes
- Existing Base44 app `6a67a778342a8fe05ee79cba` has a native Capacitor 8 Android project at `android/`.
- `capacitor.config.json`: `appId: com.base6a67a778342a8fe05ee79cba.app`, appName `Interplanetary Fund`, bundled Vite output `dist`. **No `server.url` override in production.**
- Exact provided Firebase project is `interplanetary-fund`. Root `google-services.json` is copied to `android/app/google-services.json`; the Firebase Android client package matches the native `applicationId`.
- Google Services Gradle plugin `4.5.0`, Firebase BoM `35.0.0`, `firebase-common` only. **No Firebase Auth, Firestore, Analytics, Crashlytics or FCM functionality enabled.** These need separately approved features, policies and tests.
- Android backups disabled to avoid accidentally backing up IFund WebView tokens.
- Capacitor packages pinned at `8.4.3`. Setup and web build run on Node `22.23.2`; Node 24 is not an approved IFund build runtime.
- Hosting, DNS, Cloudflare routing, Base44 user IDs, Base44 authentication, donation ledger and primary data model remain unchanged. No Android or web release was published.
- `scripts/verify-android-firebase.mjs` validates package/project matches and boundaries.

## Android release gate — NOT YET CLEARED
IFund's existing `src/pages/Login.jsx` logs in by making a **same-origin** request to `/api/apps/<id>/auth/login`. A packaged Capacitor WebView typically serves local assets from its own origin and **does not automatically forward that path to the live Base44/Cloudflare backend**. This must be implemented and tested through a secure Android-specific session flow before publishing an APK; do not switch all users to Firebase Auth or use `server.url` in production to conceal this problem.

Native Google/Apple/social sign-in, session persistence, redirects and PayPal flows require separate on-device verification. Do not claim Android login works until tested. All existing web accounts remain on Base44; no user migration planned.

## How to complete and test
1. On a workstation with Node 22, Android Studio, JDK/Android SDK installed: `npm ci`, `npm run build`, `npx cap sync android`, `npm run verify:android-firebase`.
2. Open with `npx cap open android`. Sync Gradle and build a **debug** APK first. Verify the Google Services Gradle plugin produces resource values from the matching JSON.
3. Validate secure native-to-Base44 authentication (including no CORS/cookie leakage), login, registration, logout, password reset, and existing accounts. Do not ship if account persistence fails.
4. Exercise navigation, scrolling, uploaded photos, external publishing consent, payments, links and mobile notifications as relevant. Confirm no double processing of donations.
5. After a real device test, handle branding icons, accessibility, permissions, app signing and Play Console. For Google/other OAuth add app signing SHA-1/SHA-256 and configure only legitimate redirect and intent routes.
6. Release via a separate explicitly authorized action; never deploy Firebase Hosting. Do not enable remote Firestore client access to privileged data. Any backend Firebase access requires Base44 permission checks plus minimal IAM.

## Rollback
Remove or disable Android build/release only; preserve the existing IFund website and its Base44 data. Do not roll back web routes or existing auth.

## Environment limitation
The connected Base44 environment has Node 22 for web builds, but Java/Android Studio/Android SDK are not installed, so generating or testing a signed Android APK is not yet verified here.
