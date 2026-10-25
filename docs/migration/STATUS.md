# Migration status — 2026-10-24
Authority: [issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137)

- [ ] Phase 1 — clean scaffold, decision, complete inventory: **in progress**. 95 entity contracts, 184 function entrypoints, 11 connectors, 10 agents, 17 workflows, all 364 frontend files statically inventoried. Dynamic callers, detailed authorization maps, and dynamic cross-feature parity remain; build proof is recorded below.
- [ ] Phase 2 — 95 source-entity typed staging definitions, RLS and service isolation: **IN PROGRESS**; 95 private staging tables and 95 fail-closed client policies drafted in pending/; exact Base44 owner/admin read/write parity, source-to-UUID mapping, and staging execution remain UNVERIFIED and APPROVAL-GATED. Existing 4-table illustrative preview SQL remains a separate unapplied Phase 1 proposal.
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

## Phase 2 static verification
- The Phase 2 branch adds 95 table drafts across 79 content, 12 financial and 4 credential-reference entities; all 95 enable RLS and deny unverified clients.
- Six initial legacy-ID foreign keys are staged after table definitions; remaining relationships need data validation before activation.
- Original private agent conversation SQL preserved in pending/ unchanged after a provenance header from source commit `6f7fd599`.
- **Not applied** to any Supabase environment; database tests/actual RLS outcome are unverified. No data imported or converted.
- CI to execute `npm ci`, `npm test` (includes Phase 2 schema invariants), `npm run build`, and CodeRabbit review on its PR.
