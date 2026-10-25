# Phase 3 — Identity and owner-linking plan (not activated)
Authority: [issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137), owner decision on 2026-10-24.

## Sign-in methods
- Supabase Auth OAuth: **Google and Facebook** only. Instagram is **not an authentication method**; it is a social connection that users may authorize after signing in.
- Email one-time numeric code: passwordless fallback through Supabase `signInWithOtp` followed by `verifyOtp(type: 'email')`. The Supabase email template MUST be set to `{{ .Token }}`; the default magic-link template is **not** an OTP code. The email provider, redirect allowlist, rate limits and template changes all require express owner approval.
- No email-and-password signup. No existing Base44 password or third-party OAuth grant is assumed transferable.
- Configuring either Google or Meta OAuth client, credentials, Supabase provider toggles or email template is **approval-gated**. None was done in Phase 1.

## Private owner mapping (proposal, not applied)
A private `ifund_migration.owner_identity_map` stores `source_owner_id` (legacy opaque ID), `source_email` (access-controlled), `verification_state='awaiting_destination_login'`, optional `destination_auth_uid`, and timestamps. Unique source ID and a separate unique constraint on non-null destination UID prevent double claims. Use the already existing mapping/schema where present; do not recreate it blindly. Deny `anon` and `authenticated` access; RLS must be enabled and grants restricted. Import only with owner-approved audited export; neither IDs nor emails are to be checked into Git.

## Link transaction and consent
1. User signs in with Google, Facebook or verified email OTP; server validates the Supabase access token by calling Auth `getUser`, and records confirmed provider email from trusted Auth data. Never trust frontend-supplied user IDs, names, provider-email text, or `user_metadata`.
2. A server-only lookup identifies **exactly one** eligible source record matching the verified email after explicit normalization rules (avoid alias and case ambiguities; reject duplicates/empty emails). It returns only eligibility, no private source identifiers to the browser.
3. The user must click an explicit **Confirm link** action. The backend verifies active session, CSRF/origin, fresh consent challenge and idempotency nonce. It writes a durable consent audit row in the **same database transaction** that atomically links the source record to the exact JWT-derived `auth.users.id`.
4. If email match is missing, duplicate or not trustworthy, the backend sends a code to the **pre-existing Base44 account email** through an approved provider. The challenge links only the server-selected source account and verified destination session. Verify nonce, time-to-live and retry count server-side; the user cannot choose arbitrary legacy ID or destination UID.
5. If provider verification or code proof fails, do not link. Log a non-secret denial event and offer independent support recovery with recorded owner consent. Never infer admin or super_admin status from an email string alone.
6. Audit and review the role mapping, conflicts, linked campaigns and donations, account deletion restrictions and identity uniqueness in staging using a synthetic fixture (owner approval required to apply any SQL).

## Source work to adapt (read-only)
`interplanetarysister/interplanetary-fund2`, branch `migration/owner-proof-gate-20261023`:
- Adapt the **atomic service-only commit plus audited consent** principles from `host/migration/owner-proof-rpcs.sql` and `host/migration/owner-link-gate.mjs`, **without a Base44 active session requirement**.
- Optional read-only references: `phased-cutover-policy.mjs`, `owner-consent-origin.mjs`, `finalization-audit.sql`, `plan-campaign-shadow-reconciliation.mjs`.
- **Explicitly excluded:** `owner-proof-adapters.mjs`, `owner-consent-route.mjs`, `owner-historical-upgrade-gate.mjs`, `owner-consent-dispatch.mjs`, source `host/gateway/worker.js` changes, and `wrangler.toml` routes.
- Do not cherry-pick or merge the source branch. Do not drop/change existing owner RPCs `ifund_migration_owner_commit` or `ifund_migration_owner_lookup` without independent authorization.

## Test gates
- Fake identity, wrong/duplicate email, unverified social email, replay nonce, two simultaneous links, stale session, wrong-account consent, CSRF mismatch, expired code, failed provider email, and inactive account must all **fail closed**.
- Explicit approval is necessary before creating provider apps/credentials, making auth-template changes, applying SQL to any Supabase instance, or exporting Base44 data.
- No user accounts or production OAuth sessions were linked by this document.
