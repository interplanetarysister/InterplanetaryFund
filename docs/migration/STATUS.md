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
