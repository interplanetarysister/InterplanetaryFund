# Firebase configuration for Interplanetary Fund (2026-10-11)

**Status:** Firebase is NOT yet authorized or live-connected. Existing Base44 app ID: `6a67a778342a8fe05ee79cba`. User reports an existing Firebase project with display name **Interplanetary Fund**, but its exact project ID is unverified.

## Non-disruption rules
- Maintain existing Base44 authentication, user IDs, campaigns, donations, subscriptions, ledger, and primary database. No migration or duplicated authoritative writes.
- Maintain current hosting, Cloudflare Worker routes, Base44 origin, domain, DNS, and build/deploy pipeline. Do NOT turn on Firebase Hosting.
- Firestore is initially for isolated future features only, behind an OFF-by-default flag.
- DO NOT enable Firebase Auth as a replacement for IFund login. Firebase Security Rules cannot directly trust Base44 auth tokens.
- Client Firebase web config is not a privileged credential; Admin SDK keys and private tokens are secrets and must be kept only in appropriate backend secrets or workload identity. Never commit or paste them into chat.
- Keep Firestore locked down. The reference `firebase-firestore.rules.example` denies all client requests and is not deployed. Server IAM must also be minimal.
- No client read/write to private Firestore data. Future access must validate Base44 identity server-side, then use narrowly scoped server credentials.

## Owner authorization checklist
1. Sign into https://console.firebase.google.com/ and choose the existing project **Interplanetary Fund**; do not create another.
2. Project settings > General: copy exact `projectId` and register/select a Web app (nickname `IFund Web`). Leave the optional Firebase Hosting checkbox off.
3. Obtain Firebase web config (`apiKey`, `authDomain`, `projectId`, `appId`, optional `storageBucket`, `messagingSenderId`). These are project identifiers, not service-account private keys.
4. If Cloud Firestore is desired, create in production/locked mode, select an appropriate region, do not open test rules. Do not deploy this repository's reference rules to an existing database without reviewing current rules.
5. Authorize the available official Firebase plugin against that exact Google/Firebase project via the user-controlled connection flow. This is separate from logging into Firebase Console.

## Activation checklist
- Verify project ID/permissions and app registration.
- Verify Base44 login/register/reset/logout and existing user IDs remain unchanged.
- Verify hosting, API routing and primary data remain unchanged.
- Test deny-by-default Firestore from browser; test privileged access with a disposable, isolated document through a Base44-authorized backend only.
- Test negative authorization cases; confirm no donor or financial data flows to Firebase.
- Only enable a feature after test approval; rollback = turn the feature flag OFF.

**Pending:** Firebase owner authorization and verified project config. No Firebase code path is activated or deployed by this file.
