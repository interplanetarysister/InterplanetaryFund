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

## Agent/workflow reconnection staged — 2026-10-26

**Code-only PR candidate (not deployed):** added complete 10-agent/17-workflow/11-connector registry, deny-by-default execution gate, shared web/app status page, read-only `/api/automations/readiness` endpoint, and synthetic tests. See [AGENT_WORKFLOW_RECONNECTION.md](AGENT_WORKFLOW_RECONNECTION.md). No handlers or schedules are enabled. Target Supabase project `ssibsfmtodgximseeqsv` lists zero Edge Functions and zero public app rows. Older private `ifund_ops` tables are not migrated proof. Remaining Phase 4 agent ports, trusted queue/events, provider OAuth, budget and consent audits, data and owner identity migration, and domain deployment are blocked by #137 gates. Do not label 'connected' until live verification.


## Phase 4 Cloudflare durable runner and 184-function scope — October 26, 2026

- **Implemented in draft PR #157 (not deployed):** an independent Cloudflare `WorkflowEntrypoint` (`worker/nativeAutomationWorker.js`); 17 historical scheduled/entity workflow contracts in the source registry; 184 historical functions in `worker/legacyFunctionCatalog.json`; timezone-aware cron evaluator honoring Pacific daylight saving time; deterministic Cloudflare instance IDs; staged native Workflow binding in `wrangler.automations.jsonc`; and bounded read-only independent Supabase readiness endpoint `GET /api/health/independent`.
- Scheduled triggers are **deliberately not configured**, and `IFUND_AUTOMATIONS_ENABLED`, `IFUND_SCHEDULES_ENABLED` and release flag default off. No Workflow gets queued, no account is affected, and no paid model/provider call is made.
- Added HMAC-SHA256 authenticated and timestamp-limited **internal-only** `POST /v1/internal/entity-events` contract with UUID event IDs and idempotent Cloudflare instance IDs. It rejects unsigned, stale and unknown entity events, and still rejects *validly signed events* until the exact handler and original entity transition policy have been independently ported and approved.
- Cloudflare Workflows runner supports retriable step contracts and reserves the 3-day delay for volunteer follow-ups, **but no source handler is registered yet**. This is an executor framework, not a functional port of the 17 workflows.
- `worker/automationSchedule.js` detects source cron patterns in UTC and America/Los_Angeles. The historical daily cron for the workflow named "Weekly Writing Psychology & Social Trends Training" is held until weekly semantics and deduplication can be verified. "Campaign Sync on Update" originally watches a `CampaignUpdate` create event; preserve that until mapped to the new schema.
- The source agent count is 10, connector-type count 11, workflow count 17 and function count 184. **None may be declared live or working from a manifest alone.**
- **Actual account inspection, read-only October 26:** Cloudflare listed legacy `interplanetary-fund2`, `ifund-oauth`, `ifund-email-ingress` scripts; all 16 site-specific API route patterns still pointed to the legacy `interplanetary-fund2` Worker; the Cloudflare Workflows list returned **zero** workflows. The three IFund scripts had zero cron schedules at inspection. These checks do not verify account/provider connection state.
- `scripts/verify-worker-cutover.mjs` is fail-closed and must pass **after** individually verified handler ports, owner-approved retirements, provider grants, per-user consent, audit/outbox persistence, RLS testing, and activation approvals. It currently correctly fails cutover by design. Use `--summary` for non-passing development status.
- Independent Worker design follows Cloudflare's WorkflowEntrypoint and `create({id,params})` API documentation ([Worker API](https://developers.cloudflare.com/workflows/build/workers-api/)), retrieved October 26, 2026. No live Cron, Worker deployment or Workflows instance was started.

### Still required for live operations

1. Port and end-to-end verify each necessary original function or explicitly retire it with owner approval; the original 184 function directories are **not** 184 replacement implementations.
2. Port source agent tools/context/delegation, authorized model calls, approvals and audit trails; preserve user-scope. Do not copy privileged backend prompts to public browser bundles.
3. Build and migrate the private workflow outbox, job history, scheduling cursor, retries and deduplication in the intended Supabase project. Verify source last-run and in-flight states before enabling triggers.
4. Complete original entity event hooks, provider token refresh, social/OBO consent and platform rate limits; isolate payout, ledger and PayPal reconciliation until independently approved and tested.
5. Deploy to a non-production Cloudflare Worker on a known free budget, with two-role negative tests and no Base44 proxy. Then separately review 59-page parity, web/Android use, the 7-phase release gates and cutover.

## Further code implementation — October 26, 2026

- `worker/adminIntegrationHealth.js` now implements an authenticated **read-only** admin/super-admin provider-health endpoint. It validates bearer identity against the current Supabase Auth user endpoint, checks trusted `app_metadata.role` rather than user-editable metadata, optionally verifies a Cloudflare token using the provider's token verification API, and never reports PayPal/OAuth/social as connected without separate provider evidence. The service defaults off unless `IFUND_ADMIN_HEALTH_ENABLED=enabled` and the independent preview API environment is configured.
- `src/pages/Automations.jsx` exposes on-demand integration verification only in the administrator UI. The backend independently enforces the role. It receives only sanitized status strings—no credentials, account IDs or internal tool prompts.
- `worker/campaignWrites.js` enforces the **original Campaign Protocol minimum** for publishing an active campaign (positive goal, title, category, cover URL, story, summary), but preserves incomplete draft saving. The destination's live SQL constraint does not yet enforce the original cover requirement, so `docs/migration/sql/ifund_publish_protocol_review.sql` records an unapplied, review-only constraint to prevent direct database API bypass.
- `worker/automationAudit.js` adds an **independent private D1 audit-journal interface** using prepared, bound SQL statements and terminal-state protection. A D1 migration is included in `d1/migrations/0001_ifund_workflow_audit.sql`. The workflow runner now mandates an `IFUND_AUDIT_DB` binding before any verified workflow can run and journals start/success/failure through durable steps. Idempotent Cloudflare instance IDs are carried in both signed entity events and scheduled instances.
- **No D1 journal database has been created or bound**: read-only connected Cloudflare inspection found D1 databases `ifund-oauth` and `onlycryptids-media-scout`, neither an appropriate journal. Do not reuse their private data or create a new paid-capable resource without verified cost and isolation.
- Cloudflare Workers account reports usage model `standard`; Billing Read permission is unavailable through the current connection (403), so remaining no-cost capacity cannot be proven. Deployment, D1 provisioning, Cron activation and consumer traffic have **not** been performed.
- These changes add independent infrastructure and tests, **not** migrated real agency/workflow functionality. The core original 184 source functions remain unmapped to verified independent executors, all 17 workflows still have `ported:false`, and the new target Supabase RLS/public data remains unpopulated.

### Verification and critical gaps

Node tests and Vite build check protocol, status, audit logic and basic frontend; they **do not compile or remotely execute** the `cloudflare:workers` native Worker entrypoint, install D1 migrations, validate real OAuth/PayPal evidence, or prove end-to-end events across app and web. A dedicated isolated Worker dry-run/deployment test, real private D1 binding, account/role setup, signed event source and migration of original function handlers are still mandatory. No production traffic switch has been made.
