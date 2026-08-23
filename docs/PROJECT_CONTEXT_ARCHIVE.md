# Interplanetary Fund — Project Context Archive

**Purpose:** Durable project memory for future agents and continuation work.
**Last updated:** 2026-08-23

## Canonical architecture

- `interplanetarysister/interplanetary-fund2` — canonical user-facing Base44 application.
- `interplanetarysister/InterplanetaryFund` — authoritative Convex/backend and internal-agent runtime.
- `interplanetarysister/interplanetary-fund-backend` — legacy/reference unless explicitly assigned.
- `interplanetarysister/fundforge-ai` — older Base44 application repository, reconciled for decommissioning; not a production source of truth.
- Base44 is the application layer; Convex is the authoritative backend/runtime and source of truth for persistent agent state and backend behavior.
- Vercel is hosting/deployment infrastructure and is not the definition of the project's Convex agents. Current GitHub inspection has not established Vercel as an essential active component of the current architecture.

## Agent-team operating model

The project uses role-specific agents. **Do not assume every agent has the same instructions.**

The Convex Builder Agent team has a distinct workflow documented in `interplanetary-fund-agent/handoffs/CONVEX_BUILDER_AGENT_WORKFLOW.md`.

Sequence:
1. Agent 1 implements.
2. Agent 2 independently reviews the actual implementation.
3. Agent 1 corrects validated findings.
4. Agent 3 independently verifies the resulting exact head.
5. Only after the applicable final gate passes is the work ready for publication/merge.

A failed inspection feeds findings back into the implementation/review loop.

## Agent communication rules

- Do not have multiple agents unknowingly implement the same change.
- Before starting, inspect the current issue/PR, current head, existing handoffs, and recent findings.
- Reviewers must record concrete evidence and next actions.
- Final verification must inspect the resulting/current head.
- Static inspection or simulated/historical events must not be represented as current runtime proof.
- Preserve an audit trail in GitHub.

## Repository reconciliation — 2026-08-23

Do **not** copy the entire internal-agent repository into `interplanetary-fund2`. Each repository owns material required by its role:

- `InterplanetaryFund` owns internal-agent identity, orchestration, memory/permissions, Convex/backend runtime, internal protocols, audits, handoffs, and portable internal knowledge.
- `interplanetary-fund2` owns the user-facing Base44 application, frontend, application entities/configuration, application-layer agents, and application-specific workflows.
- `interplanetary-fund-backend` remains legacy/reference material.
- `fundforge-ai` is reconciled as historical/decommissioned and should not receive new production work.
- Shared architectural decisions are referenced through explicit source-of-truth documents rather than duplicated wholesale.

## FundForge reconciliation — 2026-08-23

The owner-scoped FundForge repository is `interplanetarysister/fundforge-ai`. It is an older Base44 application. Its campaign/application features overlap with and are superseded by the current `interplanetary-fund2` application, which contains the corresponding campaign area plus expanded current AI, health, funding, cross-platform, and outreach functionality.

The reconciliation found no identified FundForge AI feature that blocks decommissioning it as a production application source. **It is ready for archival/removal from active project use**, subject to confirming that no still-needed external Base44 app/deployment or service depends on it.

Preserve Git history. Prefer **archive before permanent deletion**. Agents must not begin new production work in FundForge AI. If historical code is needed, cite its path/commit and migrate only the required capability into the current canonical repository after review.

## Project priorities

- Stabilize agent runtime and Convex concurrency before expanding autonomous work.
- Preserve source-of-truth boundaries.
- Prioritize security, authorization, financial integrity, idempotency, concurrency, auditability, and privacy.
- Do not silently introduce competing backend systems.
- Historical capabilities must be deliberately reviewed before promotion into production.

## Continuity rule

The project owner should not have to repeatedly restate established architecture, role boundaries, workflow, or decisions. Agents should consult this archive and role-specific documents first. When a genuinely new decision is made, record it in the appropriate canonical GitHub document and update dependent reference material.

This archive preserves context; it does not grant permission to bypass security, review, runtime validation, or repository ownership controls.
