# Interplanetary Fund — Canonical Repository Architecture

**Effective:** 2026-08-21

## Production ownership

| Repository | Role | Source of truth |
|---|---|---|
| `interplanetarysister/interplanetary-fund2` | User-facing Base44 application | UI/application state only; selected backend state may be mirrored for display |
| `interplanetarysister/InterplanetaryFund` | Canonical Convex backend and agent runtime | **Yes — authoritative production backend** |
| `interplanetarysister/interplanetary-fund-backend` | Legacy/reference snapshot | **No — do not add new production features** |

## Agent system

Convex in this repository owns canonical agent identity, capabilities, permissions, automation state, working memory, long-term memory, task outcomes, and agent activity. The Base44 application may initiate conversations and send interaction summaries through the explicit bridge, but it must not establish a second authoritative agent-memory store.

## Repository-local workflow

Every change must be built and reviewed in the repository that owns the change:

1. Open and inspect the target repository.
2. Create a feature branch in that repository.
3. Implement only that repository's change.
4. Review and test against that repository's code and runtime.
5. Apply corrections and review again until clean.
6. Mark the reviewed PR ready for review/publish.
7. Merge only into that same repository's `main`.

Cross-repository integration is performed through explicit interfaces, not by merging a PR from one repository into another.

## Legacy backend policy

`interplanetary-fund-backend` is retained because it contains historical capabilities that must be audited before retirement. Examples include earlier payment-router work, migration tooling, and mobile implementation history. If a unique capability is still production-relevant, migrate it into this repository through a repository-local feature branch after comparing it with the current implementation. Do not make the legacy repository a second production source of truth.

## Base44 application boundary

`interplanetary-fund2` remains the current Base44-linked application. Its Agent Chat, Mission Control, campaign UI, onboarding, and Base44 functions remain application-layer behavior. Authoritative backend state and persistent agent memory belong in this repository.

## Safety boundary

AI agents may recommend and record outcomes, but human approval remains required wherever the platform's existing permission model requires it. Agent-memory synchronization must not grant permissions, bypass approval gates, or modify payment authorization semantics.
