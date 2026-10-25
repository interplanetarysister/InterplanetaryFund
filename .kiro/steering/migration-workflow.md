---
inclusion: auto
name: ifund-migration
description: Use when implementing, reviewing or planning any Interplanetary Fund Base44 exit, Supabase or Cloudflare migration phase, cutover, schema, auth, functions, data import, frontend parity or deployment task.
---
# IFund seven-phase migration execution

Primary authority: https://github.com/interplanetarysister/InterplanetaryFund/issues/137

1. Phase 1: scaffold, independent stack decision record, full verified Base44 inventory, reviewable `AGENTS.md`.
2. Phase 2: every source entity mapped to a typed Postgres table with access parity, indexes, foreign keys and RLS. Financial tables are service-write only; vault never accessible to anon/authenticated clients.
3. Phase 3: Supabase Auth, identity and role mapping with a verified ownership claim path; don't infer admin from unverified email.
4. Phase 4: port backend functions/agent workflows/connectors with auth, audit, rate limiting and idempotency; handle financial webhooks in isolated reviewable changes.
5. Phase 5: port pages/components and remove every Base44 runtime import. Keep save/publish/reload paths working.
6. Phase 6: write idempotent export/import plus per-table row-count/hash reconciliation scripts. Never run live export/import without separate owner authorization.
7. Phase 7: Pages/Workers, staging checks and domain/DNS/rollback runbook preserving mail; no live switch until owner approves and gates pass.

For each work item:
- Look at `docs/migration/STATUS.md`, `INVENTORY.md`, `BLOCKERS.md`, relevant code and source contracts first.
- Verify that the action belongs to the active phase and does not duplicate existing changes.
- Make one reviewable, tested increment; update status and blockers.
- Identify tests actually run, deployment state, failures, unknowns and next action.
- Never merge obsolete #136, push to read-only source, or auto-merge phases. Base44 may be unpublished only after all seven cutover gates and owner's decision.
