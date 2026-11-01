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
- [ ] **44 routes partially implemented**, **15 placeholder routes remaining**;
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

## Historical route continuation update — My Giving

The /giving route now has a dedicated read-only page and worker endpoint. The API returns only captured PayPal donations for the verified donor, validates ownership/currency/cents/capture timestamps, and keeps optional IFund support separate from campaign-gift amounts. Recurring plans, processor fees and total charged are not shown because the canonical schema does not provide the required verified fields.

The giving endpoint and regression tests have not been executed. The donations table has no donor SELECT policy, so the endpoint relies on a server-only service-role read with strict owner filtering. Auth account-lifecycle parity, browser/Android QA and the platform-wide build remain open; release remains NOT READY.
## Authentication continuation update — confirmation guard

Added a shared confirmed-email predicate for UI access, enforced it in login/signup session handling, and made the independent worker reject Auth users without a provider-confirmed email. Added callback-flow and confirmed-email regression tests, but tests remain unexecuted.

This is code-level hardening only. The canonical Supabase redirect allowlist, Site URL, confirmation email template, SMTP/deliverability, automatic-confirm setting, and real first-signup/cross-device verification remain unverified. The legal-acceptance table remains staged and unapplied, so the complete onboarding journey is still blocked. Release remains NOT READY.
## Regression verification update — October 29

The non-deploying Node 22 workflow passed: 102/102 root worker/contract tests and 127/127 web regression tests. The web route-inventory and backend-coverage audits also passed. This verifies the code-level contracts covered by those tests only.

Production is still NOT READY: no production build or browser/Android QA was run; the device authorization and legal acceptance migrations remain unapplied; canonical server secrets/preview configuration and real Supabase redirect/SMTP/template settings remain unverified; the Vercel status is still failing and is out of scope for Vercel-specific repair.
## Canonical state correction — 2026-11-01

This section supersedes the October 29 snapshot above wherever the two conflict.

- The canonical project ssibsfmtodgximseeqsv now has **55 applied migrations** in its migration ledger. The current repair branch contains matching SQL files for all 55 applied versions. Fourteen additional SQL files are pending or explicitly superseded, including the new explicit lifecycle-provenance correction; none should be treated as applied merely because it is present in the repository.
- public.ifund_legal_acceptances exists and is protected by owner-scoped RLS. It currently contains **zero acceptance rows**. The web consent gate and campaign Worker both require the current affirmative versioned acceptance. First-signup persistence and two-user RLS verification remain open.
- The canonical project currently has **three** Supabase Auth users. Each has an exact-email source-owner mapping recorded as verified, with source account active, source deletion flag false, email confirmed, and target lifecycle active/non-deletion-pending. This is the verified identity set; it does not authorize assuming legal acceptance or importing unrelated source data.
- The canonical campaign DELETE policy is already owner-scoped, active-account-gated, and draft-only. Anonymous campaign reads are active-only. Blog and blog-entry anonymous read policies are published/active-only; owner reads require an active authenticated account. These live controls were queried read-only.
- The original 20261029_ifund_editorial_readers.sql draft is marked superseded because it proposes an incompatible UUID/ifund_user_blogs model. The pending follows migration no longer recreates the existing notifications table and now gates all follow operations on active account plus current legal acceptance.
- The pending Help Center and Planet Impact migrations remain unapplied. Their staged grants and policies were tightened to avoid table-wide draft updates and to require an active administrator account.
- The independent campaign Worker now checks the current recorded legal acceptance before any campaign create, update, publish, or delete operation. The regression suite includes denied-consent and unavailable-consent-provider cases.
- CI path filters now include applied and pending Supabase migrations, worker/functions, D1, automation configuration, root and web manifests/lockfiles, and the integration branch. No current-head GitHub Actions run has yet been reported; prior successful Node test totals apply to an earlier revision only.
- PR #165 remains a draft against main, not the migration integration branch. It is not approved for merge. The correct phase integration target remains migration/supabase-cloudflare.
- Cloudflare production remains on the legacy deployment configuration, and the existing Pages Git-source/production metadata mismatch has not been reconciled. No deployment, route/DNS switch, SQL apply, payment activation, or Android release has occurred.

**Current release decision: NOT READY.** Remaining blockers include the 15 historical route placeholders and incomplete source service parity; current-head test/build execution; browser/mobile signup, login, consent and two-account RLS proof; production Auth redirect/SMTP verification; canonical production Worker/Pages binding reconciliation; Android project/signing/deep-link/device QA; full source data/owner reconciliation; and PayPal/webhook/withdrawal validation. All payment and external-provider side effects remain gated.
