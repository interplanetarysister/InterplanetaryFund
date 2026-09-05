# Interplanetary Fund — Product System Contract

**Status:** Authoritative production architecture
**Effective:** 2026-08-25

Interplanetary Fund is **one cohesive product implemented across multiple repositories**. Repositories are code boundaries, not product boundaries.

## Canonical repositories

- `interplanetarysister/InterplanetaryFund` — authoritative user-facing React/Vite application and its production-facing client integration.
- `interplanetarysister/interplanetary-fund-backend` — authoritative backend/operations repository for backend services, admin monitoring, agents, security, treasury, scheduled jobs, and operational infrastructure.
- `interplanetarysister/interplanetary-fund` — migration/reference source. Unique production-relevant capabilities are to be reconciled into the two canonical repositories; it is not an independent product.

## Single live product rule

A campaign, user, donation, connection, agent state, administrative state, or other live business object has **one canonical live identity**. It must not be duplicated into repository-local production databases merely because more than one repository consumes it.

Git repositories contain implementations. The shared production backend/data layer contains live product state.

## Cross-repository feature rule

Every feature is treated as a single product capability. A change must be classified as:

1. frontend-only,
2. backend/operations-only, or
3. cross-repository.

Cross-repository capabilities require compatible changes to all affected consumers, shared contracts, permissions, and operational monitoring before being considered complete.

## Campaign consistency invariant

For every campaign ID:

- creation through the user-facing application creates the canonical backend record;
- admin and agent surfaces read the same canonical record;
- edits update that canonical record rather than a local copy;
- campaign status, funding totals, permissions, audit history, and connected-platform state are derived from the same source of truth;
- every authorized surface must converge on the same current state.

## Deployment invariant

A production release is complete only when the affected canonical repositories are compatible with the same backend contract and the resulting end-to-end flow is verified. A repository being pushed successfully does **not** by itself mean the product release is complete.

## Migration rule

When moving functionality from `interplanetary-fund`:

- preserve behavior unless intentionally superseded;
- place user-facing behavior in `InterplanetaryFund`;
- place backend, admin monitoring, agents, security, treasury, and operations in `interplanetary-fund-backend`;
- do not migrate secrets, credentials, or obsolete competing sources of truth;
- document the originating capability and destination;
- verify imports, environment variables, schemas, APIs, permissions, and deployment configuration after migration.

## Build checklist

Before declaring a cross-repository capability complete:

- [ ] canonical data owner identified
- [ ] stable entity IDs preserved
- [ ] frontend consumer updated
- [ ] backend/API updated
- [ ] admin/monitoring updated where applicable
- [ ] agents/workflows updated where applicable
- [ ] permissions/security updated
- [ ] shared types/contracts compatible
- [ ] environment/deployment configuration checked
- [ ] end-to-end create/read/update flow verified
- [ ] no competing production source of truth introduced
