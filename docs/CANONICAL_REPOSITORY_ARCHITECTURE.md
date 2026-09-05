# Interplanetary Fund — Canonical Repository Architecture

**Effective:** 2026-09-04

## Production ownership

| Repository | Role | Source of truth |
|---|---|---|
| `interplanetarysister/interplanetary-fund2` | User-facing Base44 / React+Vite application | UI/application behavior; selected backend state may be mirrored for display |
| `interplanetarysister/InterplanetaryFund` | Canonical Convex backend and internal-agent runtime | **Yes — authoritative production backend/runtime** |
| `interplanetarysister/interplanetary-fund-backend` | Legacy/reference snapshot | **No — do not add new production architecture unless explicitly reassigned by owner** |

This September 2026 owner-authorized boundary supersedes older consolidation documents that named `InterplanetaryFund` as the user-facing application or `interplanetary-fund-backend` as the production backend.

## Agent system

Convex in this repository owns canonical agent identity, capabilities, permissions, automation state, working memory, long-term memory, task outcomes, and agent activity. The Base44 application may initiate conversations and send interaction summaries through the explicit bridge, but it must not establish a second authoritative agent-memory store.

## Repository-local workflow

Every change must be built and reviewed in the repository that owns the change:

1. Open and inspect the target repository.
2. Implement only that repository's owned portion of the change.
3. Review and test against that repository's code and runtime.
4. Apply corrections and review again until clean.
5. Merge/push only into that same repository's `main` after its required gates are satisfied.

Cross-repository integration is performed through explicit interfaces, not by copying a production source of truth from one repository to another.

## Legacy backend policy

`interplanetary-fund-backend` is retained because it contains historical capabilities and provenance that must be audited before retirement. If a unique capability is still production-relevant, compare it with current code first and migrate only the missing behavior into the current owning repository. Do not make the legacy repository a second production source of truth.

## Base44 application boundary

`interplanetary-fund2` remains the current Base44-linked user-facing application. Its Agent Chat, Mission Control, campaign UI, onboarding, application-layer functions/entities, and other user-facing behavior remain application-layer responsibilities. Authoritative backend state and persistent internal-agent memory belong in this repository.

## Safety boundary

AI agents may recommend and record outcomes, but human approval remains required wherever the platform's existing permission model requires it. Agent-memory synchronization must not grant permissions, bypass approval gates, or modify payment authorization semantics.

## Issue #1 reconciliation

The historical `interplanetary-fund2#1` directive to bring backend improvements into the application repository is resolved through this boundary: expose backend capabilities through explicit application/backend interfaces; do not copy the backend implementation or create a competing backend in `interplanetary-fund2`.
