> Current owner directive (2026-11-01): deployments are authorized for this build without repeat confirmation; this supersedes older deployment-approval text. Verification and rollback gates still apply.

# Migration status — 2026-10-24
Authority: [issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137)

## Current Phase 6 update — October 25, 2026

**Private cached-data transfer completed; full migration remains incomplete.**
741 newly copied cached records plus 27 previously staged campaigns now give
**768/768 exact destination payload SHA-256 matches**. Nine campaign serialization
differences were repaired under semantic-equality and source-digest guards.
No users were claimed, no public rows published, and no financial authority set.
See [the transfer report](CACHED_SNAPSHOT_TRANSFER_20261025.md) for counts,
provenance, repeatable tooling, and remaining runtime gates.
Local install, **77 tests**, and Vite build passed. A rollback-only RLS probe was
prepared but its tool execution failed with expired request state; it is not
runtime test evidence. All temporary-fixture counts remained zero on recheck.
Earlier sections below are historical evidence; the transfer report supersedes
their statements that destination content/source snapshot tables are empty and
that the Pages frontend still points at the old project.

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

## Incremental backend audit and staging operation — 2026-11-01

Deployment authority is now granted for the duration of this build by the owner;
AGENTS.md, active Kiro steering/agent instructions and the local global template
were updated so deployment confirmation is not requested again. This supersedes
older deployment-approval text; source read-only, credential protection, payment
rules and verification-before-production-switch requirements remain in effect.

Current audit deliverables are in [INVENTORY.md](INVENTORY.md), the canonical
`contracts/functions.json`, `contracts/entities.json`, `contracts/automations.json`
and the recovered `role-platform-evidence.json`. Census: 184 functions, 95
entities, 17 workflows, 10 agents and 11 connectors, pinned to original source
commit d681fb36c37f86de8d32a60f4350853d0c792f87. Proposed replacements are
explicitly distinct from implemented handlers and live parity. Imported PR #165
contract metadata is labeled historical where not freshly rechecked.

Live Chromium comparison of reference/production/Pages public home, login,
discover and help routes confirmed design/login differences, a missing production
help page and public campaign permission errors. A second read-only comparison
proved `select=*` fails while the granted public-column allowlist succeeds.
Root scaffold source still selects all columns. Current apps/web source has
20 named partial main-route mounts and 38 placeholders; the fallback is separate,
and historical `/download` is missing. No page is certified for full parity.

First bounded implementation: [geocodeCity](GEOCODE_CITY.md), using Supabase
Auth plus fresh profile lifecycle reads and the original Nominatim operation.
25 focused tests pass, including 15 executable comparisons against pinned
original handler/account-guard fixtures. A separate staging Worker was deployed:
https://ifund-geocode-staging.interplanetary-fund.workers.dev
Deployment ID b7774cf181c840cf83b8efcc3d88c51e. The browser verifier is at
`/__verify/geocode`; credentials go directly to Supabase and reports exclude
email/password/tokens. Local Chromium orchestration tests passed for synthetic
successful and rejected logins. Actual deployed page/config return 200; missing
and invalid sessions return 401; unrelated migration API returns 404. A positive
signed-in live test and original location/form persistence journey are pending.
**No production geocoding switch or completed production replacement is claimed.**

Fresh integrated checks: `npm test` **108 passed, 0 failed**; focused geocoding
suite **25 passed**; root Vite production build passed; apps/web tests **15
passed** and production build passed; `git diff --check` passed before the final
documentation update. These checks do not certify other backend operations.

Production Worker routes were read back: none route to the new staging Worker.
No existing Worker or Pages project was redeployed, no DNS/provider/database/user
state was changed, no Stripe introduced, and the read-only source repository
remained clean. Pre-existing uncommitted workspace changes were preserved.
Remaining work and the next getCampaignDraft acceptance gate are in INVENTORY.md
and BLOCKERS.md. All seven full-migration gates remain open.

## Clean draft-PR verification

The review change is isolated from the user's pre-existing uncommitted work and
based on integration commit `9e278edd9beaa99119696f0747f1532912eba3aa`.
Fresh `npm ci --ignore-scripts --no-audit --no-fund` installed 152 packages;
`npm test` passed **102 tests**, and `npm run build` plus `git diff --check`
passed. The 108-test result above belongs to the larger original workspace,
which contains separate user-owned changes. The `apps/web` comparison refers
to the audited main/work checkout, not this older integration base, which has
no apps/web directory. No user-owned Auth/UI/SQL/package edits are in this PR.
