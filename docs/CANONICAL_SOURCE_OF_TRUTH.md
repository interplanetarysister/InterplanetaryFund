# Interplanetary Fund — Canonical Sources of Truth

**Status:** Active project governance
**Effective:** 2026-08-22

## Production ownership

- **User-facing application:** `interplanetarysister/interplanetary-fund2`
- **Authoritative backend, Convex data, agent runtime, and persistent intelligence:** `interplanetarysister/InterplanetaryFund`
- **Legacy backend:** `interplanetarysister/interplanetary-fund-backend` — reference/audit only; no new production backend features.
- **Historical application snapshot:** `interplanetarysister/interplanetary-fund` — reference/audit only unless a capability is explicitly migrated through review.
- **Historical Base44 snapshot:** `interplanetarysister/interplanetaryfund-base44` — reference/audit only.
- **Retiring FundForge snapshot:** `interplanetarysister/fundforge-ai` — historical source only; unique capabilities are preserved in `interplanetary-fund2` PR #50 pending independent review.

## Rules

1. Production application changes belong in `interplanetary-fund2`.
2. Production backend/agent changes belong in `InterplanetaryFund`.
3. A PR is merged only into the repository that owns its change.
4. Historical repositories are searched before deleting or replacing functionality.
5. Historical code is not production authority merely because it exists in an older repository.
6. Recovered capabilities must be classified, modernized, tested, independently reviewed, and audited before promotion.
7. Agent memory and persistent intelligence use the canonical Convex backend; do not create competing production memory stores.
8. FundForge/Kindred names and implementations retained in recovery documents are historical evidence and must not be treated as current branding or runtime authority.

## Cross-repository contract

`interplanetary-fund2` may call the canonical backend through the established bridge/API boundaries. It must not fork backend truth into a second production implementation.

## Deletion safety

Before any historical repository is deleted, verify that its unique product rules, agent behavior, schemas, payment behavior, integrations, deployment references, secrets/configuration dependencies, and operational documentation have either been migrated, mapped to an existing canonical capability, intentionally retired, or preserved as historical specification.
