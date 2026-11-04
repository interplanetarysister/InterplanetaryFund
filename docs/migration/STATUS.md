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


## Base44 decoupling audit — 2026-11-03

A new line-by-line replacement register was started in [BASE44_DECOUPLING_AUDIT.md](BASE44_DECOUPLING_AUDIT.md). The read-only source Git tree at `interplanetary-fund2/main` commit `fb2afc64d72194c51c552bc7b5260a479d7566eb` contains 1,249 files and 346 directories (`truncated: false`). This pass verified the frontend SDK/client, runtime contract, app parameter handling, Vite plugin, package metadata, Base44 CLI config/docs, selected backend runtime bridges, media policy, PayPal callback origin, builder bridge, and agent-skill duplication.

**Important:** the source-side 95-entity / 184-function / 11-connector / 10-agent / 17-workflow / 364-frontend-file inventory is static evidence, not proof of replacement parity. The migration branch already has a Supabase client and no Base44 dependencies in its root package manifest, but the branch remains a partial scaffold. This audit is **IN PROGRESS**; no claim of full decoupling, complete line-by-line review, production readiness, or Base44 retirement is made. No source repo, production data, DNS, provider settings, credentials, or deployments were changed.


**Pass 2 update:** The branch now includes the first replaceable runtime boundary: `src/lib/api.js` uses same-origin `/api/` routes by default and optional `VITE_API_BASE_URL`, obtains bearer identity from Supabase Auth, and normalizes API errors. Added `tests/api-client.test.js` and the optional variable to `.env.example`. These tests are committed but await CI execution; existing pages are not yet migrated to this facade. This is an initial decoupling primitive, not Base44 parity.


**Neutral API client verification — PASS:** GitHub Actions run [41751234251](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/41751234251) on the PR head passed real `npm ci`, lockfile reproducibility, **82/82 Node tests**, Vite production build, and Prettier. The new API client tests cover same-origin routing, replaceable HTTPS API origin, URL validation, Supabase session bearer propagation, JSON request handling and structured HTTP errors. This verifies the adapter primitive only; current UI pages are not all routed through it, and the source's 95 entities / 184 functions / agents / workflows are not yet ported. The independent app remains a preview scaffold, not a production cutover.


---

## Owner incremental implementation directive — 2026-11-03 (current evidence supersedes earlier phase labels)

The owner requires one shared service, agent, or page at a time, preserving all earlier work. The 59 historically coded routes remain the acceptance baseline. A page is complete only when every feature-description promise and every visible action works end-to-end with the correct identity/permission, persisted data, responsive presentation, accessibility and production evidence. Coherent production pushes may be incremental; temporary disconnects must be identified, safe, reversible and never disguised as working functionality.

### Current connected Supabase state (read-only check, 2026-11-03)

| Item | Designated target InterplanetaryFund | Older Ifund |
|---|---:|---:|
| Project reference | ssibsfmtodgximseeqsv | tzehxfikoslihnclhxuz |
| Applied migrations | 73 (latest 20261103192435) | legacy history; not target |
| Tables | 88 | legacy subset |
| Tables with RLS enabled | 88/88 | legacy policies remain |
| Active Edge Functions | 4 | 3 |
| Role | retain as target | preserve until dependencies are safely moved |

Target functions observed active: ifund-member-mail-ingress v2, ifund-admin-mail-ingest v1, ifund-admin-mailbox v1, and ifund-campaign-draft-preview v2. The 88/88 RLS-enabled result proves RLS is enabled, not that every policy has correct semantics. The target has real application records, but complete source row counts, user ownership claims, media hashes and financial reconciliation are still outstanding. Prior 768/768 private snapshot hash matches remain valid but do not prove public/financial parity.

Important source-of-truth drift: the connected target has 73 applied migrations, while the current integration branch does not yet contain a matching complete migration history. Reconcile this before further DDL; never reapply existing migrations or treat a dashboard catalog as a substitute for version-controlled migration source.

### Seven-category progress

1. Authentication and identity — partial. Supabase Auth/profile lifecycle and verified-admin migrations exist; Phase 3 PR #140 and recovery callback PR #207 are prior work. Current Auth preview uses email OTP and Google/Facebook; password login plus the owner-required email recovery code flow is not complete. Finish verified owner linking, role/entitlement checks, session lifecycle and recovery end-to-end before protected pages.
2. Database entities and permissions — substantial foundation, incomplete parity. Preserve PR #139, #148 and #158; map all 95 entity contracts, all policies and all source data. The live target's 88 tables/73 migrations must be reconciled to Git. 768 cached snapshot records match hashes, but full users/campaigns/media/donations/ledger reconciliation is not complete.
3. Backend functions — partial. Preserve PR #141's 184-function manifest, existing Worker read/write routes, PR #178 geocodeCity, and PR #208 API facade. Four target Edge Functions are active; most of the 184 source operations are not ported. Map each entrypoint and consumer; test one function contract at a time.
4. AI agents and workflows — staged, not operational. Preserve PR #157's 10-agent/17-workflow/11-connector registry, durable workflow class, signed event intake and audit scaffolding. Its handler adapter map is empty and all source workflows remain unported. Build actual tool executors, scoped memory, Chief of Staff delegation, and owner-only coding builder; no workflow activation until its real handler, authorization, idempotency and audit are verified.
5. External integrations and credentials — partial. Preserve 11 connector definitions, OBO/consent, PR #145 PayPal slice and PR #158 mail schema work. Secret names are inventoried; secret values/provider handshakes remain. Keep PayPal as the approved rail and do not introduce Stripe as a substitute. A configured credential is not a verified connection.
6. Media storage and uploads — partial. Cloudflare R2 is available. Complete byte/hash inventory, transfer, access control, URL remapping and image-quality parity remain. Preserve watermark, original quality, responsive sizes, crop/focal point, WebP, SVG and GIF animation.
7. Deployment and build configuration — partial. Preserve merged Phase 1 #138, deployment gate #146, preview #206, API facade #208, Node 22 baseline and rollback work. The old domain Worker still has Base44 routes and custom-domain Pages ownership/production settings need verified reconciliation. Do not claim cutover based on a build or preview alone.

### Existing PRs are cumulative project work

Continue/reconcile rather than discard: #138 merged; #139 schema; #140 auth; #141 function inventory; #142/#155/#156/#159 page/layout restoration; #145 PayPal; #146 cutover gate; #147 ZIP intake; #148 private snapshot transfer; #157 agents/workflows; #158 single-Supabase consolidation; #178 geocodeCity; #192 visual Studio builder; #199 campaign story editor; #204/#205/#206 visual parity and preview; #207 auth recovery; #208 decoupling audit/API facade. Each branch must be checked against current integration head before merge; no wholesale merging of stale or conflicting stacked branches.

### Next exact work

1. Reconcile 73 live target migrations with version-controlled SQL and the existing PR #158 consolidation record.
2. Finish password login + email recovery code and complete identity/role/session tests.
3. Continue PR #208's line-by-line source audit and API facade migration without touching the read-only source repo.
4. Implement and verify the real agent/workflow handlers and owner-only coding builder.
5. Finish one route at a time using the existing 59-route role/platform evidence matrix. Do not count a mounted or limited route as complete.


### Password recovery delivery blocker (2026-11-03)

The connected Supabase organization is Free and the designated target project was created 2026-10-24. Supabase's June 3, 2026 change prevents new Free projects using default SMTP from customizing Auth email templates. The required code-first recovery UI can be implemented, but code delivery is not proven until the target uses an approved custom SMTP sender or its current recovery template is verified to contain the OTP. Track as B13 in BLOCKERS.md; retain PR #207's link callback support as a compatibility path, not as a substitute for the requested email code. No email-provider credentials or settings were changed.


### Phase 3 authentication slice — PR #209 (2026-11-04)

PR #209 continues the existing Phase 3 work without replacing PR #140 or #207. It adds password-first sign-in on /login while retaining the previous email OTP and Google/Facebook paths, plus /forgot-password and /reset-password pages. The reset page supports the six-digit recovery OTP flow and the existing Supabase PKCE/token_hash callback route. Return destinations are same-origin constrained; recovery responses do not disclose whether an email is registered.

**Exact-head CI verification:** GitHub Actions run 41766718964 on commit 330700b68e99a8a6c8acee67277eddb8690f8205 passed reproducible npm lock resolution, **88/88 tests**, Vite production build, and Prettier. This verifies the code/test/build layer only.

**Still not complete or production-ready:** no real member password sign-in has been tested against the target project; legacy Base44 identity ownership linking remains pending; no SMTP configuration or email template was changed. The connected Supabase organization is Free and the target project is newer than the June 3, 2026 default-SMTP template restriction. Therefore code-based password recovery remains externally blocked under B13 until the target's recovery template is confirmed code-enabled or an approved custom SMTP sender is provisioned. PR #209 remains draft and the auth routes are classified implemented_unverified, not verified_parity or cutover_ready.
