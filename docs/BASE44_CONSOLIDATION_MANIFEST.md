# Base44 Consolidation Manifest

Source: `interplanetarysister/interplanetary-fund2`
Target: `interplanetarysister/InterplanetaryFund`

## Rule

`InterplanetaryFund` is the authoritative application. Base44-origin definitions and useful application capabilities are migrated here; they must use the authoritative Convex data layer and must not create a second source of truth.

## Verified source areas

- `base44/agents/` — agent definitions
- `base44/entities/` — Base44 data-model definitions
- Base44 Vite/React frontend and configuration
- `.github/skills/` and workflow/build guidance
- agent runtime/unification documentation

## Already migrated

Canonical agent-definition records have been added under `docs/base44-agent-mapping/` in the target repository for the verified Base44 agents inspected during consolidation.

## Remaining migration rule

Before deleting or retiring any Base44 source, compare its functionality against the target application and Convex schema. Migrate missing functionality first, then verify build, auth, data integrity, payments, agents, and deployment.

## Deployment

Vercel remains paired with `InterplanetaryFund`. Convex remains the shared live backend/data source for user-facing and admin records.
