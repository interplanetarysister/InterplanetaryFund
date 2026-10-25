# Migration status — 2026-10-24
Authority: [issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137)

- [ ] Phase 1 — clean scaffold, decision, complete inventory: **in progress**; source census and static inventory of 95 entity contracts, 184 function entrypoints, 11 connectors, 10 agents, 17 workflows, and 364 frontend files recorded; dynamic callers, ownership/response contracts, and build verification remain.
- [ ] Phase 2 — migrate 95 entities and full RLS: **not started**; 3-table illustrative staging SQL only.
- [ ] Phase 3 — Supabase Auth identity mapping + role gates: **not started**.
- [ ] Phase 4 — function and integration parity (184 function entrypoints): **not started**.
- [ ] Phase 5 — full frontend port: **not started**; scaffold only and editor load guard.
- [ ] Phase 6 — live data and media export/import reconciliation: **blocked** by missing authorized test export and row counts.
- [ ] Phase 7 — Pages/Workers cutover runbook, DNS preservation, staging QA: **not started**. No deployment or DNS changes.

Verified: branch derived from README-only current main; #136 is obsolete; read-only inventory from interplanetary-fund2; 25 applied Supabase migration history entries. Tests/build: **not yet verified on installed dependencies**; npm registry is inaccessible from current environment and lockfile generation is blocked. New editor save-gate unit tests added; local Node-only execution and lockfile status must be verified independently. No production schema/data/provider mutations.
