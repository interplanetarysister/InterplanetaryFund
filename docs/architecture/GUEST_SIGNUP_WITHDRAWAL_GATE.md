# Guest signup, ownership, and withdrawal verification (2026-11-10)

**Canonical application:** `apps/web` of `interplanetarysister/InterplanetaryFund`. Production Cloudflare Pages project: `interplanetaryfund-migration`. Production Supabase project: `ssibsfmtodgximseeqsv`.

## Intended user journey

1. Public pages and campaign creation are accessible without email, password, identity documents, or a login wall.
2. On `/register`, review current public Terms and Privacy documents and explicitly confirm age 18+ and agreement to `2026-11-10-v4`.
3. "Continue without verification" first attempts a Supabase-issued **anonymous session**. When the Auth provider permits anonymous sign-in, the user obtains an **owner-bound ID**, a protected profile, and an explicit legal acceptance receipt; server-validated ownership and RLS permit account-scoped features while preserving financial safeguards.
4. **Current production constraint (verified against Auth `GET /auth/v1/settings` on Nov 10):** `external.anonymous_users=false`. If anonymous sign-in fails, **do not claim the user owns a cloud account**. Offer a browser-only editor and session-storage draft, with an explicit notice: not uploaded, not published, not recoverable on another device, may be lost after the tab closes. Never show fake save/publish success.
5. Email/password signup is optional at onboarding for cross-device recovery. Supabase currently has `mailer_autoconfirm=false` and `disable_signup=false`; email confirmation may remain pending, but public guest editing is accessible without completing it.
6. On `/withdrawals`, prompt anonymous account users to verify an email via `auth.updateUser({email})` and the Supabase email-change callback. After verification, offer password setup. This merely verifies **account access**, not legal KYC or payout eligibility. Existing payment features must still require processor authorization, verified campaign ownership, reconciled funds, and any regulated identity checks. Do not enable transfers via a client-side flag.

## Security and privacy invariants

- Supabase anonymous Auth users have role `authenticated` **but** a distinct JWT identity claim `is_anonymous=true`. They are *not* equivalent to public requests using the publishable/anon key without a session. All account writes remain owner-scoped to server-validated `auth.uid()` and protected by RLS.
- Do not loosen `isVerifiedEmailUser` globally. `guestIdentity` applies only to non-financial account operations, and `payoutIdentity` must exclude anonymous accounts. Production backend payout authorization must independently confirm identity.
- Legal acceptance is never inferred from `localStorage`. Cloud agreement receipts are stored **only** in `public.ifund_legal_acceptances`, after explicit confirmation and server-side owner verification. A browser-only guest acknowledgement is **not** a recorded account acceptance.
- The server-side `ifund_current_user_has_current_terms()` RLS helper now checks `2026-11-10-v4`, matching signup and `apps/web/src/lib/legalPolicy.js`. Applied via `20261110_ifund_current_legal_terms_sync.sql`.
- Guest campaigns may be publicly posted only when their owner identity is backed by a valid Supabase session and explicit agreement, and only through the standard campaign lifecycle and RLS. No service-role or temporary publish bypass.
- Never map an old Base44 profile by matching email alone; preserve strict migration-owner mapping.
- If anonymous sign-ins are enabled later, configure and test anti-automation protection (CAPTCHA/Turnstile and rate limits), account recovery, spam moderation, anonymous account cleanup, RLS, session/device loss, and payout denial before broadly advertising cloud guest publishing. Supabase anonymous Auth is currently disabled and cannot be enabled through the available Supabase MCP management tools.

## Verification

- Focused unit tests in `apps/web/tests/guestAccess.test.js`, `guest-auth-return.test.js`, `guest-public-routes.test.js`, and `owner-campaigns.test.js` cover one-click guest route, no-session fallback, ownership isolation, unverified-email rejection, and payout boundary.
- Cloudflare Pages preview builds execute `npm ci && npm test && npm run build`. Verify the exact branch SHA and runtime HTML before promoting.
- Supabase confirmed a *rolled-back* authenticated insert of the current terms receipt and successful `ifund_current_user_has_current_terms()`, with no persistent test acceptance left behind.
