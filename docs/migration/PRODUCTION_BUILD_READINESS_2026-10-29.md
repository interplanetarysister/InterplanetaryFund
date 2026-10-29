# Interplanetary Fund — production build readiness (2026-10-29)

**Decision: NOT READY.** This is a source/pre-build engineering checkpoint, not a
deployment approval or claim that web and Android production routes work.

This checkpoint is for user-directed notification: **notify the owner when every
release gate has independent evidence and the platform-wide build is ready,
but do not execute a build, deploy, DNS cutover or payment action without
the separate owner's authorization.** The existing hourly continuation
automation has the same condition.

## Current independent implementation coverage

- [x] Mapped all **59 source routes** to an original source component.
- [ ] **43 routes partially implemented**, **16 placeholder routes remaining**;
      **zero** source pages have complete browser, role, visual and Android parity.
- [x] Original **95 entity definitions**, **1,126 source fields**, **184 server
      functions**, **10 AI agents**, **17 workflow triggers**, and **11 connectors**
      enumerated and cross-referenced.
- [ ] Complete service parity, authorizations, call contracts, true source
      assets, production listeners, real schedules and external integrations:
      original **184 functions** still lack full runtime verification.
- [x] First-login and email-link callback source repaired; signup username
      and six-to-eight-digit OTP UI, resend, password recovery, original
      AuthLayout, Terms gate and verified session navigation staged.
- [ ] Real signup, confirmation link/OTP, password reset, new user onboarding,
      logout/login, provider redirect allowlist and email template tests;
      production build/deployment and Android flows not executed.
- [x] Source-three.js interactive Globe preserves original 3D visuals, pin selection, WebGL fallback and accessible listing, with opt-in-only location query and nullable coordinates. All staged; no node install, texture validation or browser test yet.\n- [x] Institution directory/detail screens now preserve original card/type
      visuals and categories, approved-only public discovery and opportunities,
      protected by staged PostgreSQL RLS.
- [ ] Globe coordinates opt-in and source asset delivery not activated;\n      public campaign location migration unapplied.\n- [ ] Institution create/manage/applications/owner identity/import not ported,
      and SQL is **unapplied**.
- [x] Backend provenance, finance and ownership guards prevent unsupported
      sample donation totals or financial side effects.
- [ ] Original campaign owner IDs **0/27** staged-linked to canonical Auth;
      independent public campaigns and donations **0**; original export
      completeness and ledger reconciliation unproven.
- [ ] Verified PayPal sandbox/webhooks/withdrawals, provider OAuth, original
      10 agents and 17 automated workflows with audit and cost controls.
- [ ] Original native Android navigation, assets, login/deep links, build
      and device QA verified.

## Concrete signup-release blocker confirmed today

A read-only query of canonical Supabase `ssibsfmtodgximseeqsv` public
tables found `public.ifund_profiles` but **no
`public.ifund_legal_acceptances`**. The independent app wraps protected
routes in `TermsAcceptance`; that component queries
`ifund_legal_acceptances` through `legalAcceptanceStatus` before allowing
entry. Consequently the account may confirm email and still fail to complete
first login/onboarding. The missing table has an owner-scoped, affirmative
consent RLS migration staged at
`supabase/migrations/pending/20261029_ifund_legal_acceptances.sql`;
it has **not** been applied. Do not make legal acceptance optional or
silently mark users agreed to work around this blocker.

A separate read-only Auth audit showed 3 confirmed users, including two newly
created that day, and authentication logs with confirmation mail-send events
and invalid_credentials responses. These do not prove real email delivery or
a verified login journey.

## Additional staged migrations (unapplied)

- `supabase/migrations/pending/20261029_ifund_follow_notifications.sql`
- `supabase/migrations/pending/20261029_ifund_editorial_readers.sql`
- `supabase/migrations/pending/20261029_ifund_institutions_readers.sql`
- `supabase/migrations/pending/20261029_ifund_legal_acceptances.sql`
- Other pending admin/help/security migrations as indexed in the PR.

Each requires a reviewed safe SQL plan, canonical-provider connection,
two-account RLS positive/negative tests, mobile behavior checks and
reversibility before counting as functional. Never expose client-deny
`ifund_stage` financial/owner data by granting broad public access.

## Build gate and task continuation

The repository's release checker is
`scripts/verify-migration-readiness.mjs --release`; npm's
`prebuild` runs it before every Vite build. It is deliberately blocked
until all above proof is complete. Every backend handler must additionally
pass `scripts/audit-backend-coverage.mjs --release`. No build was run;
latest GitHub PR head reported no PR-triggered GitHub workflow runs and
a **Vercel failure** status, not passing CI.

Continue porting 19 remaining source routes and their API/role/data
dependencies, then reconcile the original 184-function graph and verified
production users. Only notify **READY** once the actual source-equivalent
web + Android release and compliance checks pass, not when code files merely
exist.

## Historical route continuation update — device authorization

The /activate and /devices historical routes now have dedicated web pages and a first-party worker API path for request, inspect, approve/deny, token polling, scoped reads, listing and revocation. The route inventory has moved two routes from placeholders to partial implementation; this does not certify either route end to end.

Worker regression tests and SQL assertions were added but have not been executed. The device schema/RPC migration remains staged and unapplied. Canonical server secrets and preview configuration are unverified; no browser/Android QA or platform-wide build was run. The release decision remains NOT READY.
