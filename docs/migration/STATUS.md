# Migration status — 2026-10-24
Authority: [issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137)

- [ ] Phase 1 — clean scaffold, decision, complete inventory: **in progress**. 95 entity contracts, 184 function entrypoints, 11 connectors, 10 agents, 17 workflows, all 364 frontend files statically inventoried. Dynamic callers, detailed authorization maps, and dynamic cross-feature parity remain; build proof is recorded below.
- [ ] Phase 2 — migrate 95 entities and full RLS: **not started**; 4-table illustrative staging SQL only.
- [ ] Phase 3 — Supabase Auth identity mapping + role gates: **not started**.
- [ ] Phase 4 — function and integration parity (184 function entrypoints): **not started**.
- [ ] Phase 5 — full frontend port: **not started**; scaffold only and editor load guard.
- [ ] Phase 6 — live data and media export/import reconciliation: **blocked** by missing authorized test export and row counts.
- [ ] Phase 7 — Pages/Workers cutover runbook, DNS preservation, staging QA: **not started**. No deployment or DNS changes.

Verified: branch derived from README-only current main; #136 is obsolete; read-only inventory from interplanetary-fund2; 25 applied Supabase migration history entries. **Tests:** local `npm test` against the copied `validation.js` and test file passed **9/9 Node tests** (campaign validation and editor loaded-ID save gate), Node v22.16.0. **Not verified:** end-to-end browser app, Vite bundle, dependencies installed through npm, schema against staging, OAuth, RLS, payments. Npm registry access failed with EAI_AGAIN. A **dependency-metadata assembled** lockfile is now committed (210 entries, includes Tailwind/PostCSS, no Base44 packages; root pins and dependency path metadata checked), but `npm ci` and `npm run build` remain UNVERIFIED. See B7. No production schema/data/provider mutations.

## Verified internet-connected build — 2026-10-24 local / 2026-10-25 UTC
**PASS** — [GitHub Actions run 40156868430](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/40156868430), standard `ubuntu-latest` runner with Node **v22.23.3**, npm **10.9.9**. This is a public repository's standard free runner, not a paid larger runner. Steps reported success:
- `npm install --save-dev --save-exact prettier@3.6.2 --package-lock-only --ignore-scripts --no-audit --no-fund`: **PASS** — regenerated true npm lock from accessible npm registry.
- `npm ci --no-audit --no-fund`: **PASS** — 152 installed packages.
- `npx --no-install prettier --write "src/**/*.{js,jsx,css}"`: **PASS**; generated multiline code committed to PR head as `b62e726`.
- `npm test`: **PASS — 9 tests, 0 failures**.
- `npm run build`: **PASS — Vite 6.4.3, built in 2.08s**.
- `npx --no-install prettier --check "src/**/*.{js,jsx,css}"`: **PASS**.

**Scope and caveats:** this validates an actual npm dependency install, Node tests and frontend bundle for the tested head, not Supabase runtime login, cross-account RLS, schema execution, provider OAuth, media/financial parity, or deployment. Separate CodeRabbit latest-head review findings and owner approval gates remain. No production service was changed.

## Secret-hand-off inventory — 2026-10-25
**Inventory complete; transfer NOT STARTED.** The Base44 owner supplied 20 secret names. No values were requested, accessed, imported or committed. [SECRET_DESTINATIONS.md](SECRET_DESTINATIONS.md) maps PayPal (3), Buffer (4), Eventbrite (1), Cloudflare (1), Browserbase (1), Convex (8) and Stripe (2) to target owners/retirement gates. Read-only Cloudflare checks found no Worker secret bindings on current `interplanetary-fund2` or `ifund-oauth`. Payment PR #145 now supports modern Supabase `sb_secret_...` keys, but its provider webhook, database ledger, end-to-end and production configuration remain UNVERIFIED. See B12 in [BLOCKERS.md](BLOCKERS.md). No production change or new credential transfer was made.


## Phase 1 merge readiness review — 2026-10-25

- Rechecked the phase source against current review findings. Dependencies for Tailwind/PostCSS and the null-client auth guard are present. Campaign editor inputs are now disabled until the exact owner campaign read completes; community textarea is disabled while its submitted content is saving. Existing owner campaign/post foreign keys use `ON DELETE RESTRICT`, not cascading deletion.
- Restricted proposed browser grants for the four-table preview schema: client inserts/updates may touch owner identifiers and content columns only, not `created_at`, `updated_at`, record IDs (except self profile ID) or provider verification columns. Added `tests/phase1-privilege-policy.test.js` to check this security property.
- [Phase 1 latest-head CI #40260130979](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/40260130979) **PASS**: Node tests, npm resolution, Vite build, source formatting. Prior out-of-date CI failures are superseded.
- **Review scope:** This is a code-only integration-branch candidate. It is NOT a finished migration, does not establish actual cross-user Supabase RLS runtime, and must never be deployed as a full Base44 replacement. Source SQL grant corrections are **not applied** to the live Supabase database; any previously applied broader grants must be separately reconciled through an approved migration.


## Integration branch verified merge record — 2026-10-25 (supersedes earlier in-progress section labels)

**Integration source code merged, NOT released or cut over.** The following PRs merged into `migration/supabase-cloudflare`: #138 (Phase 1 scaffold, security grants and build), #149 (owner-only actions), #150 (Phase 4 gated nonfinancial Worker endpoints), and #151 (Phase 5 gated campaign/community editor). These merges do not mean full Phase 4 or 5 parity.

- **Phase 1**: baseline merged. Initial four-table SQL, RLS and browser-column-grant restrictions are present in Git; validate/repair the already-existing destination project grants separately before live activation.
- **Phase 2**: 95 source entities inventoried and private typed staging is present in the designated Supabase project, but complete runtime RLS/foreign-key/default parity remains unverified; PR #139 has requested review changes and post-merge conflicts.
- **Phase 3**: Supabase Auth user migration/owner links remain unverified. Live project `ssibsfmtodgximseeqsv` has **zero Auth users** at this check. PR #140 remains blocked.
- **Phase 4**: [independent API route matrix](INDEPENDENT_API_ROUTE_MATRIX.md) merged and [PR #150 CI](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/40261185306) succeeded. Code includes read-only public feeds, verified-owner draft/profile/connection reads, owner-scoped campaign/content writes, safe draft-only deletion, and bounded JSON requests. **Other 184 source function parity, provider callbacks, agent workflows and financial behavior are not complete.** Worker preview gate remains off.
- **Phase 5**: gated, signed-in campaign and community UI improvements merged via #151; [CI](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/40261349005) succeeded. Both `VITE_IFUND_CAMPAIGN_API` and `VITE_IFUND_COMMUNITY_API` default disabled; remaining original 57-page functionality and legal-policy review are incomplete.
- **Phase 6**: live destination `public.ifund_campaigns` and `public.ifund_posts` have **zero rows** at this check, with no Auth users. Private staged legacy records are not published user campaigns or proof of owner consent. PR #143's export verifier remains unmerged.
- **Phase 7**: Cloudflare still has **16** active domain Worker routes assigned to `interplanetary-fund2`; that deployed legacy Worker may proxy Base44. Pages project `interplanetaryfund-migration` has production branch `migration/phase7-offline-cutover-gate` and production deployments disabled. **No cutover was activated.**

Remaining integration blockers are recorded in `BLOCKERS.md` below and in #137. PRs #139–#143 became conflicted after the clean Phase 1 merge; they require per-phase reconciliation and review. Original PRs #141/#142 contain overlapping stacked changes: use merged #150/#151 as the baseline instead of merging their obsolete overlapped code wholesale. PRs #144–#148 need their separate gates. **Do not deploy, enable migration flags, switch DNS/API traffic or perform financial writes based solely on code merges.**


## October 29 build-preparation continuation (source-only; supersedes stale earlier counts)

See [BUILD_PREPARATION_2026-10-29.md](BUILD_PREPARATION_2026-10-29.md) and `contracts/`.
- Verified by read-only canonical Supabase metadata: **95/95** source-named private staging tables, **95 RLS enabled**, **1,126/1,126** source field-name matches; no policy/runtime/type/data parity asserted.
- Original **59** historical routes are explicitly registered; **23 partial**, **36 reserved/unported**, **0 release-verified**. Added embed, guarded browser install and source-agent readiness screens; protected routes require verified user and admin role UI gate. No page is claimed complete by having a route.
- Original **184** function names recorded with **236** directly observed frontend call sites covering **123** distinct function names; indirect invocations remain unknown.
- Original **10 agents**, **17 workflows** (11 scheduled, six entity triggers), and **11 connectors** are mapped. All 17 workflow handlers map to the function census. No AI tools, schedules, cron dispatch, account grants or financial provider effects were activated.
- Campaign draft editing now permits partial saves with source-matched limits and all **11** categories in UI and Worker validator, with synthetic category tests added. No new publish/donate/withdraw feature activated.
- `apps/web` now has `check:inventory`, `check:release`, and `prebuild` release-blocking logic for Cloudflare production/main. Added 19 owner-evidence launch gates and tests; **not executed** because owner requested only preparation, not a build.
- No secrets, financial SQL, data imports, DNS switches, Cloudflare deploy settings, payments, Android signing or workflows were changed. Existing mixed Supabase Cloudflare configuration, 16 legacy Worker routes and Android artifacts remain unresolved; do not launch on these structures alone.


## October 29 follow-up: creator campaign operations and typed-schema audit

**Prepared and committed to draft PR #165; no build or deployment.**
- Added `apps/web/src/pages/MyCampaigns.jsx` and `apps/web/src/lib/ownerCampaigns.js`: authenticated member route `/mine`, draft editing at `/create?draft=:uuid` and `/edit/:id`, owner-derived queries and **explicit confirmed draft-only deletion**. Links added to the signed-in dashboard. All writes are still governed by canonical Supabase RLS. Live authenticated browser tests remain pending.
- Added native share/copy-link and read-only campaign iframe embed-code UI, with strict UUID and HTTPS origin handling. Campaign payment capture remains disabled and cannot run in an embed.
- Enumerated **1,126/1,126 field types** in source/SQL catalog; direct mappings include 834 string-to-text, 75 source string-to-timestamptz, 73 number-to-numeric, 3 integer-to-bigint, 65 boolean-to-boolean, 22 object-to-jsonb, and 54 array-to-jsonb. Schema-type crosswalk is in `contracts/schema-type-crosswalk.json`. Timestamp serialization, original defaults and enum behavior are **not verified**.
- Independent read-only canonical Supabase table metadata still shows 27 private staged campaigns and zero public campaigns, donations, and financial ledger rows, with two public profiles; these are row-count observations, not a source/data reconciliation.
- Production readiness now additionally refuses mismatched/missing `VITE_SUPABASE_URL`, `SUPABASE_URL`, or `SUPABASE_JWKS_URL`, incomplete schema roundtrips, and outstanding Android identity/signing evidence.
- Source-only contract checks and seven isolated Node tests of owner campaign operations and sharing logic were executed locally and passed **after correcting a typo in the temporary test-copy UUID regex**. These were copies of the branch helpers; this is not an app-wide `npm test`, browser integration run, Vite build, Android build, or proof of production readiness.


## October 29 follow-up: dormant Cloudflare-native workflow scaffold

Recovered and source-committed from the previous phase4 migration branch:
`worker/nativeAutomationWorker.js`, `worker/automationEngine.js`,
`worker/automationEvents.js`, `worker/automationSchedule.js`,
`worker/automationAudit.js`, `wrangler.automations.jsonc`, and an
unapplied private D1 audit migration. Ported the corresponding four safety tests.
The real Cloudflare `WorkflowEntrypoint` and `step.do/sleep` API shape was
checked against current Cloudflare documentation (2026-10-29).
All schedules and execution remain **disabled** in config; `workflowExecutable`
rejects all 17 source contracts with `ported:false` and the engine has an
empty independent adapter registry. No outside network, message, scheduled
social post, donation or withdrawal was executed.
An isolated in-memory SQLite check of the D1 schema confirmed trigger/state
constraints and that a succeeded audit record cannot be overwritten by later
failure. This is not a real Cloudflare D1 integration test.


## Owner-directed full-backend repair sweep — October 29 continuation

The owner requested all remaining pages and all backend functions be audited and repaired until fully operational, while retaining the separately applicable no-build/no-deploy restriction. All work in this section is **committed only to the open draft PR**.

- Route matrix: **59/59 original URL definitions mapped with source component/file and directly detected function/entity/auth dependencies**. **28 partial implemented UI surfaces**, **31 feature routes still pending**; **0 full release-verified**. Three source-component exceptions (special organization mail, a historical download route, redirect) were explicitly mapped. The original 59 pages yielded 56 directly detected original function references, 47 direct entity references and 36 direct Auth references, with all names present in their original inventories.
- New real partial UI/service restorations: member onboarding writes profile under canonical RLS, a cautious *self-only* profile preview (no non-owner posts/profile aggregation until source privacy consent is mapped), an owner-scoped mission dashboard, admin read-only Ops/Analytics consoles, a private paused-campaign owner preview, and owner-driven campaign publication with complete content validation.
- Backend source audit: **184/184 original functions accounted for** with 398 function→entity edges, 236 direct frontend call sites and five direct source-function invocations. Seven independently coded routes are classified as partial candidate replacements, **zero source functions are certified fully operational**. Risk triage: 45 financial, 16 identity/privileged, 48 external, 31 AI/metered and 44 application. Full per-function repair ledger in `BACKEND_REPAIR_AUDIT_2026-10-29.md`. `scripts/audit-backend-coverage.mjs` fails a release for incomplete or unapproved handlers, is integrated into the web test script, and has an independent contract test.
- Fixed owner draft read/write lifecycle filtering: draft reads require `status=eq.draft`; draft save or delete cannot downgrade/delete a published record. Added regression tests. Corrected profile server validation for 100-char display names and optional handle clearing; added regression tests. Protected-route UI now revalidates account on sign-in/token refresh.
- Production build gate is now unconditional for any `--build`, not contingent on a Cloudflare-provided branch name (no bypass when `CF_PAGES_BRANCH` is missing). No builds executed.
- Read-only Supabase audit confirmed private staging entity tables have *client-deny* policies, preventing safe naive front-end porting. Current public tables cannot support 31 missing feature backends with original privacy or content. A pending SQL change narrows direct EXECUTE privileges for the `public.ifund_create_auth_profile()` SECURITY DEFINER trigger; NOT applied. Test signup/rollback before applying.
- No native APK, provider sandbox, cross-user browser, payment/withdrawal, database mutation, DNS, workflow activation or deployment was executed.
- The existing hourly continuation task has been updated with explicit priorities to keep porting 31 remaining pages and reviewing the entire 184-function graph on future runs, honoring no-build/no-deploy instructions.


## Read-only canonical campaign reconciliation checkpoint (2026-10-29)

Read-only Supabase aggregate queries: `ifund_stage.campaign` contains **27** rows,
**27/27 unique nonnull original legacy IDs**, **17 active**, **10 drafts**, **zero
auth UID owner links**, and therefore **zero independently matched owner accounts**.
The independent `public.ifund_campaigns` and `public.ifund_donations` tables
each contain **zero** rows. Source archive re-export verification is absent;
the prior checkpoint's 28-source-record claim must not be treated as a proven
current export. Canonical stage lacks an original `created_by_id` column, so
do NOT guess ownership. Evidence in
`contracts/data-migration-checkpoint.json`.
Production release gate now requires owner identity proof, complete source
campaign reconciliation, ledger integrity and import approval before any cutover.

New content-only campaign publish helper, associated tests, private paused-campaign
preview and conditional source URL behavior were staged without running the
application or changing the database. Backend security review produced an
unapplied profile trigger EXECUTE-grant tightening migration, which must be
reviewed with auth/signup verification before execution. The existing hourly
continuation automation was updated to keep auditing original source parity
on future runs while preserving no-build/no-deploy restrictions.


## Migration continuation: independent code repairs and status (2026-10-29)

The connected GitHub PR #165 remains **open and draft**. Cloudflare Pages
`interplanetaryfund-migration` remains `production_deployments_enabled=false`
and `preview_deployment_setting=none` (read-only API verification). **No builds,
deployments, database writes or DNS changes performed.**

Historical route matrix update: **36 partial UI ports, 23 placeholder/blocked
historical routes, zero independently certified full UI parity**. Source
implementation is not operational equivalence.

Specific restorations committed this continuation:

- Signup/login: original space-glass branded authentication screen, username
  registration, two passwords, Supabase email-link and OTP verification,
  resend links, recovery, legacy `/dashboard` email-link recovery,
  `/auth/callback` one-time code/token handling, first-login onboarding
  and unified verified Home/sidebar session display. Confirmed and
  unconfirmed sessions are differentiated; invalid credentials do not
  silently create accounts. Historical Base44 account/password migration,
  Supabase redirect allowlists, email templates/SMTP and native Android
  deep links still require genuine external tests.
- Versioned user agreement `2026-10-13-v3`: original Terms Acceptance text,
  account-specific consent persisted by canonical Supabase with server
  timestamp and RLS. A cross-account stale acceptance display race was fixed.
  The SQL is staged, not applied; old acceptance history reconciliation and
  actual login-to-consent tests are mandatory release blockers.
- `/following` and `/notifications`: original owner-specific controls and
  canonical Supabase services staged with RLS, no browser-created financial
  notifications or payment impersonation. Original follow history and
  notification producer remain unverified.
- `/blogs`, `/blogs/:id`, `/publications/:id`: original Reporter,
  member blog, safe campaign-embed, and approved publication reader
  layout/logic ported, with published-only RLS tables staged. Real author
  ownership and original records still need verification.
- `/admin/help`: original Help Center Editor with private drafts, stable
  published article URLs and a SECURITY INVOKER atomic publish RPC;
  canonical read service merges genuinely published articles with existing
  public migration guidance without exposing private drafts. Admin JWT
  role, RLS, published content and native/device QA pending.
- `/admin/sustainability`: original Planet Impact UI and browser-local
  transfer-size observations restored; source-backed environment campaigns
  and administrator evidence log. Client cannot grant
  `independently_verified` status, forge CO2/energy numbers or bypass
  approved provider evidence. RLS table staged only.
- New source-oriented regression test files for auth, editorial, legal
  acceptance, Help Editor and Planet Impact were committed but **were
  not executed as a full repository test run**. No release certification.

Security migration files are all under `supabase/migrations/pending/`.
They must be reviewed, reconciled with provider and role configuration and
explicitly authorized before applying to the canonical production DB. A
production build remains blocked by verification gates, not silently
enabled by staged UI components.


## October 29 independent prebuild verification — current continuation

**Current independent branch:** `migration/build-completeness-gates-20261029`  
**Current PR:** [#165 — Draft](https://github.com/interplanetarysister/InterplanetaryFund/pull/165)  
**Verified code head:** `87fe408ac7b8fab4cf0eeabbab219ae67cee8233`  
**CI:** [run 40964893372](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/40964893372) and paired run 40964885435 — both **PASS**.

- Worker/contract tests: **102/102 passed**.
- Web regression tests: **130/130 passed**.
- Route/entity/function/automation inventory consistency: **passed**.
- Backend coverage audit: **passed as a static census**, while correctly refusing full release certification.
- Independent Vite frontend compilation: **passed** (Vite 6.4.5). CI installs web dependencies and compiles without bypassing the release gate.
- A regression was corrected in verified-session handling: a genuinely signed-out visitor is now distinguished from an Auth provider verification failure. Protected routes can send a signed-out visitor to login while remaining fail-closed when a session exists but the provider cannot verify it.
- The normal app `prebuild` / release gate remains closed. CI compile success is not production-build approval or a deployed artifact.

**Completeness remains blocked:** the evidence manifest currently records 44/59 routes as partial, 15/59 as placeholders, and 0/59 release-verified. The 95 entity, 184 function, 10 agent, 17 workflow, and 11 connector inventories remain source mappings, not completed live ports. Real signup/login/browser tests, Supabase Auth provider configuration, legal-consent RLS tests, 27 staged campaign owner links, source data/media reconciliation, AI copy/image providers, automation executors, Android signing/deep links, and production preview/rollback evidence remain outstanding. Financial checkout, donations and withdrawals remain paused.

The CI dependency install for `apps/web` currently uses `npm install --no-package-lock`; an app-specific reproducible lockfile is still required before dependency resolution can be certified as reproducible. The Vite build was a compile check, not a production deploy. No production data, secrets, schema, DNS, Cloudflare deployment settings, or payment providers were changed.

**Separate source repository:** `interplanetarysister/interplanetary-fund2` main remains at its pre-existing checkpoint; PR #535 remains Draft and has unresolved SQL/RPC/security/test/reconciliation blockers. Do not merge it as part of this independent web prebuild. Keep both repositories and app identities separate.


## October 29 Cloudflare environment audit — production changes not made

Read-only Cloudflare account inspection confirms that Pages project `interplanetaryfund-migration` has the apex, www, and preview domains attached. Its production branch is `main`, production deployments are disabled, and preview deployments are disabled; the latest attempted preview for the migration branch was skipped. The last canonical production deployment observed is from `main` commit `658dc2c88183c8297a6e107eee49b79ef7a5bf49`, not the current migration branch.

**Critical mismatch:** browser `VITE_SUPABASE_URL` is configured for canonical project `ssibsfmtodgximseeqsv`, while production Worker-side `SUPABASE_URL` and `SUPABASE_JWKS_URL` point to a different project, `tzehxfikoslihnclhxuz`. The deployed `interplanetary-fund2` Worker still owns 16 active apex/www routes; the independent Worker in this repo is not proven to own any production route. Pages reports `uses_functions: false`. No bindings, secrets, routes, deployments, DNS, or Pages settings were changed. This mismatch must be reconciled before any preview/API activation or release.


## October 29 Supabase project and migration-state reconciliation

A fresh read-only connector inspection identified two active Supabase projects with distinct responsibilities. The **canonical independent runtime** is `ssibsfmtodgximseeqsv`; it has 3 Auth users (all confirmed), 3 public profiles, 0 public campaigns, 1 public post, 0 public connections, 0 donations, 0 payment events, 0 rows in the listed finance/workflow/mail/outreach schemas, and 0 deployed Edge Functions. The **legacy migration/staging project** is `tzehxfikoslihnclhxuz`; it contains 27 private campaign shadows (17 active, 10 draft), 10 owner identity-map rows, 42 source records (10 CampaignUpdate, 32 PlatformConnection), 4 import batches, 13 cutover controls, 397 agent-activity shadows, 26 agent-delegation shadows, and 266 content shadows.

The earlier data checkpoint incorrectly attributed the 27 campaign shadows to the canonical runtime project. `contracts/data-migration-checkpoint.json` has been corrected to separate the two projects and their evidence. In the legacy project, three owner-map rows are marked `verified` after exact confirmed-email matching and join to 20 campaign shadows; seven campaign shadows remain associated with map rows awaiting destination login. **This is not explicit owner consent**: the applied service-only RPC checks exact email and updates the map, but no consent-receipt table or user-initiated consent proof was found. The 27 shadow rows contain source-hash fields, but those hashes have not been independently recomputed; the earlier source export referenced 28 campaigns and has not been re-exported to establish completeness. No shadow rows have been imported into the canonical runtime.

Security advisor findings on the canonical project include a public `SECURITY DEFINER` trigger function (`public.ifund_create_auth_profile()`) whose EXECUTE ACL currently includes anon and authenticated, and disabled leaked-password protection. The function is attached to the `auth.users` INSERT trigger; its intended trigger use must be preserved while removing unintended direct RPC exposure. RLS-enabled tables without policies are present in private schemas; those policies must be reviewed in context rather than replaced with broad client policies. No Supabase schema, Auth setting, RLS policy, function ACL, or data was changed during this inspection.
