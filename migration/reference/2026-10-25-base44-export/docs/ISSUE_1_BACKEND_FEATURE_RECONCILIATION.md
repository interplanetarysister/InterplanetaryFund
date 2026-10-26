# Issue #1 — Backend Feature Reconciliation

**Status:** completed architecture reconciliation for the original request to “bring all backend features repository improvements to this repo.”

## Current canonical ownership

The original Issue #1 wording predates the current repository boundaries. The current owner-authorized architecture is:

- `interplanetarysister/interplanetary-fund2` — canonical user-facing Base44/React+Vite application layer, application entities/configuration, application-layer functions/agents, onboarding, campaign/user UX, Mission Control, Agent Chat, and application-specific behavior.
- `interplanetarysister/InterplanetaryFund` — authoritative Convex/backend and internal-agent runtime: persistent agent identity/memory/permissions, orchestration, scheduled intelligence, treasury/payments backend, backend protocol and other authoritative persistent backend state.
- `interplanetarysister/interplanetary-fund-backend` — legacy/reference only unless the owner explicitly assigns a new role. Do not add new production backend architecture there.

## Resolution of Issue #1

“Bring backend improvements to this repo” must now mean **make the user-facing application consume and expose the relevant backend capabilities through explicit interfaces**, not copy the backend implementation or create a second source of truth in `interplanetary-fund2`.

Therefore:

1. Backend-only capabilities stay in `InterplanetaryFund`.
2. Application-facing support for those capabilities belongs here and is implemented through an explicit function/API/bridge.
3. Historical capabilities from `interplanetary-fund-backend` are reference material only. A unique capability is first compared against the current canonical implementations; if still needed, the backend portion is migrated to `InterplanetaryFund` and the application-facing portion to `interplanetary-fund2`.
4. No backend feature is considered “incorporated” merely because files were copied between repositories.
5. No production capability may be duplicated across the three repositories.

## Existing reconciliation coverage

The current repository already contains the durable application/back-end boundary and bridge documentation:

- `docs/REPOSITORY_SOURCE_OF_TRUTH.md`
- `docs/BUILD_CONTEXT.md`
- `docs/AGENT_RUNTIME_UNIFICATION.md`
- `docs/IF_FEATURE_RECONCILIATION_2026-08-21.md`

The implementation backlog has also been decomposed into canonical feature/security/financial/integration issues rather than leaving unspecified backend migration hidden inside Issue #1. Those issues remain independently responsible for their actual implementation and verification; closing Issue #1 does not close or waive any of them.

## Required rule for future work

Before moving functionality between repositories:

1. identify the authoritative owner;
2. inspect existing implementations in all relevant repositories;
3. preserve working architecture;
4. migrate only missing unique behavior;
5. implement cross-repository integration through a documented boundary;
6. verify authorization, financial integrity, data ownership and idempotency;
7. build/test in the owning repository;
8. do not declare completion while a known defect or required fix remains.

## Historical-document precedence

Any historical document that calls `InterplanetaryFund` the authoritative user-facing application, or directs wholesale Base44 decommission/consolidation into it, is superseded where it conflicts with the owner-authorized September 2026 repository ownership rule. Such historical documents may be retained for provenance but must be clearly labeled so agents do not act on stale architecture.

## Completion condition

Issue #1 is complete as a broad migration/coordination task because its safe interpretation is now explicit and every remaining concrete build belongs to its canonical issue/workstream. Actual product/security/financial TODOs remain open until individually implemented, verified, and merged to their owning repository's `main`.
