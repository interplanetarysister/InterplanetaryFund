# Base44 Consolidation Manifest — Historical / Superseded Direction

> **Architecture notice (2026-09-04):** This document was created during an earlier consolidation attempt. Its statement that `InterplanetaryFund` is the authoritative user-facing application is superseded by the current owner-authorized repository boundaries. Retain this file for provenance; do not use it to move the current application out of `interplanetary-fund2`.

## Current canonical ownership

- `interplanetarysister/interplanetary-fund2` — canonical user-facing Base44/React+Vite application layer.
- `interplanetarysister/InterplanetaryFund` — authoritative Convex/backend and internal-agent runtime.
- `interplanetarysister/interplanetary-fund-backend` — legacy/reference only unless explicitly reassigned by the owner.

The current authoritative references are `docs/CANONICAL_REPOSITORY_ARCHITECTURE.md`, the latest owner-priority repository directives, and the matching `interplanetary-fund2/docs/REPOSITORY_SOURCE_OF_TRUTH.md`.

## Historical source/target record

During the earlier consolidation pass this file recorded:

- historical source: `interplanetarysister/interplanetary-fund2`
- historical target: `interplanetarysister/InterplanetaryFund`

That wholesale application-consolidation direction is **not current**.

## What remains valid from the historical audit

The following source areas remain useful evidence when reconciling functionality:

- `base44/agents/` — application-layer agent definitions/history
- `base44/entities/` — Base44 application data-model definitions/history
- Base44 Vite/React frontend and configuration
- `.github/skills/` and workflow/build guidance
- agent runtime/unification documentation

Canonical agent-definition records previously added under `docs/base44-agent-mapping/` remain historical/reference material where still useful.

## Current migration rule

Before retiring or replacing any historical source:

1. compare its capability against the current implementation;
2. identify the canonical owning repository;
3. migrate only genuinely missing production-relevant behavior;
4. put backend/runtime behavior in `InterplanetaryFund`;
5. put user-facing/application behavior in `interplanetary-fund2`;
6. use explicit interfaces between them instead of creating duplicate sources of truth;
7. verify build, auth, data integrity, payments, agents, and deployment before retirement.

Do not add new production architecture to `interplanetary-fund-backend` unless the owner explicitly changes its role.

## Deployment/source-of-truth rule

Convex remains authoritative for backend/persistent runtime state. `interplanetary-fund2` remains the current Base44-linked user-facing application. Hosting/deployment mappings must be verified against current deployment configuration rather than inferred from this historical manifest.
