# Migration status — 2026-10-24
Authority: [issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137)

- [ ] Phase 1 — clean scaffold, decision, complete inventory: **in progress**. 95 entity contracts, 184 function entrypoints, 11 connectors, 10 agents, 17 workflows, all 364 frontend files statically inventoried. Dynamic callers, detailed authorization maps, and dynamic cross-feature parity remain; build proof is recorded below.
- [ ] Phase 2 — 95 source-entity typed staging definitions, RLS and service isolation: **IN PROGRESS**; 95 private staging tables and 95 fail-closed client policies drafted in pending/; exact Base44 owner/admin read/write parity, source-to-UUID mapping, and staging execution remain UNVERIFIED and APPROVAL-GATED. Existing 4-table illustrative preview SQL remains a separate unapplied Phase 1 proposal.
- [ ] Phase 3 — Supabase Auth Google/Facebook/email OTP and verified owner linking: **IN PROGRESS**; password signup removed in Phase 1; server-only match rules, consent design and inactive SQL staged; actual provider apps, OTP delivery template, verified ID mapping, and runtime link remain approval-gated.
- [ ] Phase 4 — function and integration parity (184 entrypoints): **IN PROGRESS**. Source-function status registry lists 184; 2 server-side read-only handlers are partially prototyped but unmounted and unverified against live data; 182 remain not ported, plus provider/agent/workflow parity. No Worker routes/deployment changed.
- [ ] Phase 5 — full frontend port: **IN PROGRESS**; three static pages transplanted (About, Terms, Privacy), 10 other source pages have only partial preview counterparts, **44 source pages remain not ported**; original legal copy requires review and acceptance flow.
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

## Phase 2 static verification
- The Phase 2 branch adds 95 table drafts across 79 content, 12 financial and 4 credential-reference entities; all 95 enable RLS and deny unverified clients.
- Six initial legacy-ID foreign keys are staged after table definitions; remaining relationships need data validation before activation.
- Original private agent conversation SQL preserved in pending/ unchanged after a provenance header from source commit `6f7fd599`.
- **Not applied** to any Supabase environment; database tests/actual RLS outcome are unverified. No data imported or converted.
- CI to execute `npm ci`, `npm test` (includes Phase 2 schema invariants), `npm run build`, and CodeRabbit review on its PR.

## Phase 2 real npm CI proof — 2026-10-25 UTC
[GitHub Actions run 40157280148](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/40157280148), free public `ubuntu-latest`: **SUCCESS**. Genuine npm lockfile regeneration step PASS; `npm ci` PASS (152 packages); `npm test` PASS (**13 tests**, zero failed); `npm run build` PASS (Vite production build in **1.54s**); Prettier format/check PASS. These are code/static schema verification tests, **not** database-executed RLS tests. Phase 2 cannot be marked complete until exact Base44 RLS parity and owner-approved SQL staging checks pass.

## Phase 3 progress
- Added `worker/ownerLinkRules.js`: server-side-only exact normalized email, one-candidate checks and explicit consent requirements; `tests/phase3-owner-link.test.js` covers unverified, ambiguous, missing, already-linked and stale-consent scenarios.
- Added **inactive** `supabase/migrations/pending/phase3_owner_link_proposal.sql`: private candidate table, one-time hashed consent challenge, linked UID uniqueness, service-role-only atomic claim and audit; not applied to any database.
- **NOT READY TO ACTIVATE:** no provider OAuth apps/credentials changed, email-code template configured, actual Base44 user rows imported, owner links established, or service-side validation endpoint deployed. No browser can invoke the inactive SQL.

## Phase 3 actual CI proof — 2026-10-25 UTC
[GitHub Actions run 40157561064](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/40157561064) — **SUCCESS** on free standard public runner: npm-generated lockfile, `npm ci`, Prettier, **19/19 unit tests**, and `npm run build` (Vite 6.4.3; 2.35 seconds). These tests cover pure owner-link eligibility/consent and prior schema/editor invariants. **No live OAuth, identity claim, OTP delivery, provider credentials or database SQL was tested or changed.** Phase 3 remains incomplete.

## Phase 4 code-only activity
- Added `worker/reads.js` with **unmounted** fail-closed read prototypes for `getCommunityFeed` and `getCampaignDraft`, plus an independent public campaign listing. These require explicit `MIGRATION_API_PREVIEW=enabled`, server verification of Supabase JWT before private reads, client JWT-scoped RLS, fixed field selections and bounds.
- Added synthetic tests for disabled routes, anonymous denial, remote JWT verification, no upstream details in errors and restricted drafts.
- Function port registry: `docs/migration/FUNCTION_PORT_STATUS.json` (184 functions, two partial prototypes). Payment and ownership grants remain explicitly unported. No API/Worker route has been mounted or deployed.

## Phase 5 code-only work
- Transplanted source `src/lib/legalPolicy.js` without any Base44 SDK dependency, preserving historical terms version while explicitly requiring owner/legal review before publication.
- Added independent About, Terms and Privacy React routes. Contact, support, payments, institutions and all remaining source pages are not claimed complete.
- Added a 57-page source-to-target status manifest with no runtime-parity claims, plus structural tests. No live website routes, deployments or DNS changes.
- Phase 4 [run 40157942499](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/40157942499) passed **25 Node tests** and Vite build before this branch. Phase 5's own CI must be read independently.

## Phase 5 optional independent campaign transport — 2026-10-25

- Added `src/lib/campaignApi.js` and `VITE_IFUND_CAMPAIGN_API=disabled` in `.env.example`. The Worker transport is **off by default**. When explicitly enabled after deployed route/Auth/RLS proof, it obtains the current Supabase session JWT and sends content writes to the same-origin Cloudflare Worker `POST /api/campaigns` or `PATCH /api/campaigns/:id`.
- `CampaignEditor.jsx` keeps the current direct, owner-scoped Supabase query path while the flag is disabled. When the optional Worker path is enabled, successful writes require a returned record ID; failed network/API requests report an error without navigating away and release the busy state. New campaign creation also checks for missing Supabase configuration before attempting a write.
- Unit tests in `tests/phase5-campaign-transport.test.js` cover session-required authenticated requests, method/URL selection, rejection of provider errors and unverifiable writes.
- Existing Phase 4 Worker implementation is proposed in unmerged PR #141, not available in this branch's deployed app. **Do not enable the new frontend flag or change Cloudflare routes until PR #141 is integrated, cross-account RLS is exercised with real accounts, and owners/data/HTTP routes are independently verified.**
- The one-time public-standard-runner formatter [#40225044057](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/40225044057) succeeded and deleted itself. Actual full post-format CI status must be checked separately; no deployment, SQL, DNS, auth or payment settings changed.


## Phase 5 independent community post UI — 2026-10-25

- Added optional `src/lib/communityApi.js` transport (Bearer token from the signed-in Supabase session; no privileged key in browser). `VITE_IFUND_COMMUNITY_API=disabled` is the **default** and is documented in `.env.example`.
- `src/pages/Community.jsx` can use the new POST endpoint when the flag is explicitly enabled after route/Auth/RLS parity tests. Until then the existing direct owner-scoped Supabase insertion remains in use. The page also offers confirmation-gated "Delete my post" actions only for records whose author ID matches the current user, using the corresponding owner-restricted direct Supabase query or optional Worker DELETE endpoint.
- Added `tests/phase5-community-api.test.js` for Bearer forwarding, strict input, verified API response, exact delete ID, and no-success-on-error. All changes are code-only: no real user posts added/deleted, no provider/donation functionality affected and no Cloudflare routes changed.
- A temporary standard-public-runner formatting workflow passed ([run #40254816032](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/40254816032)), formatted `src` and removed itself. Recheck post-format PR CI separately. The Worker code lives on unmerged PR #141; the frontend flag **must stay disabled** until its backend, target database account ownership and cross-account RLS are live-tested.


## Phase 5 editor review correction — October 25, 2026

- The campaign editor now prevents edits while an existing owner campaign is loading **and while any save is pending**. This prevents locally typed content from being overwritten by a late response or successful navigation.
- The optional authenticated Cloudflare transports for campaign writes and community posts remain off by default. Direct RLS-scoped Supabase previews are not enabled for production use.
- Standard public GitHub runner [formatting job #40260761933](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/40260761933) succeeded and removed itself; CI needs a fresh owner-authored commit after its bot formatting push. No Cloudflare deployment, Stripe/PayPal action, DNS change, live SQL or user data mutation.
