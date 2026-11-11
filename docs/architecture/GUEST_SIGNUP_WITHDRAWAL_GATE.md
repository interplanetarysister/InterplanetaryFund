# Interplanetary Fund: guest browsing, email signup, and deferred MFA (2026-11-10)

Canonical frontend: `apps/web` on Cloudflare Pages `interplanetaryfund-migration`. Canonical Supabase: `ssibsfmtodgximseeqsv`. This document supersedes the earlier proposal to let anonymous accounts publish content.

## Verified requirement

1. **Visitors** may browse public pages without registering. Supabase Anonymous Sign-Ins are allowed for optional, non-authoring guest sessions when that provider switch is enabled. A guest may not post, create a campaign, edit a profile, or write any server-side content.
2. **Content creators** complete the legal-first `/register` flow and verify an email account. Signup uses ordinary email/password authentication, **not** an authenticator app or two-factor verification. OAuth providers with provider-confirmed email may also be accepted by existing authentication policy.
3. **Withdrawals** require the email owner to complete a first-withdrawal authenticator step-up. `/withdrawals` supports TOTP factor enrollment and challenge/verification, and requires an `aal2` session before reporting an authenticated second factor. This **does not enable payments or certify KYC**.
4. **Server guarantees** always take precedence over UI guards: `ifund_private.verified_email_creator()` reads `auth.users.email_confirmed_at` and `auth.users.is_anonymous` for `auth.uid()`. Restrictive RLS write policies protect `ifund_campaigns`, `ifund_posts`, `ifund_campaign_creation_state`, `ifund_campaign_translation`, `ifund_campaign_update`, and `ifund_profiles` against anonymous writes. They compose with prior ownership, account lifecycle, and terms policies.
5. `ifund_private.withdrawal_mfa_ready()` requires confirmed email **and** JWT `aal='aal2'`. A future payout Worker/RPC must independently require this security level, validate funds, campaign ownership, approved provider account, identity/KYC compliance, and preserve the established 7% fee deducted at withdrawal. No client flag is ever a payout authorization.
6. New `/create` route and member tools require a verified email account; visitors get the registration screen. This avoids a false impression that an anonymous account may publish.
7. Guests can browse `/discover`, `/social`, public campaign pages and `/dashboard` guest landing. `/register` retains a **Browse without an account** option after the legal review. If anonymous Auth sessions are enabled later, they remain guest-browsing identities only. The URL returnTo cannot route a guest directly to protected content.
8. An existing anonymous browser session can be linked to an email through `auth.updateUser({email})` rather than duplicating the owner identity. The email must be confirmed before content authoring; registration can set a password once the emailed code is verified. Password recovery remains available.

## Supabase provider configuration

The authoritative management setting is `external_anonymous_users_enabled` (Supabase Management API PATCH `/v1/projects/{ref}/config/auth`) or the **Anonymous Sign-Ins** toggle under Authentication → Providers. It is separate from `disable_signup` and `mailer_autoconfirm`, neither of which should be changed to bypass two-factor authentication.

**Connection constraint:** The Supabase tools currently connected to this conversation can query database, apply migrations and deploy functions but expose no project Auth configuration write action. Do **not** claim the toggle was enabled without the management API's authorized success response and a re-check of the project's `/auth/v1/settings` endpoint. If the toggle is still false, guest browsing continues without anonymous database identity; this does not block public browsing or email registration.

## Verification

- SQL transactional checks: a verified email account passes `ifund_private.verified_email_creator()` but without `aal2` fails `ifund_private.withdrawal_mfa_ready()`. Unconfirmed email fails the authoring check.
- Restrictive policies confirmed in `pg_policies` for all six content-bearing tables.
- Client tests cover guest-but-not-author identity, private content RLS boundary, email account sign-up, and TOTP AAL2 challenge.
- Preview build must pass `npm ci && npm test && npm run build` and live route smoke tests before main promotion.
