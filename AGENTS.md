# AGENTS.md — Interplanetary Fund Internal Agent Runtime

## Scope
This is the **authoritative Convex/backend and internal-agent runtime repository** for Interplanetary Fund.

Do not treat these instructions as universal instructions for every agent in the project. Agents must use the role-specific instructions applicable to their assignment.

## Canonical repositories

- `interplanetarysister/InterplanetaryFund` — authoritative Convex backend, persistent agent state, internal agent runtime, agent knowledge, orchestration, and backend behavior.
- `interplanetarysister/interplanetary-fund2` — canonical user-facing Base44 application layer.
- `interplanetarysister/interplanetary-fund-backend` — legacy/reference only unless explicitly assigned.

Cross-repository behavior must use an explicit API/function/bridge boundary. A change belongs in the repository that owns it.

## First-read order for internal agents

Before starting a task, load:

1. `docs/PROJECT_CONTEXT_ARCHIVE.md` — durable project decisions and continuation context.
2. `docs/CANONICAL_REPOSITORY_ARCHITECTURE.md` — repository ownership and source-of-truth boundaries.
3. `docs/REFERENCE_MATERIAL_INDEX.md` — where authoritative and historical reference material lives.
4. The role-specific identity, constitution, permissions, instructions, handoff, audit, and task documents relevant to the assigned agent.
5. The current GitHub issue/PR, branch/head, recent handoffs, and findings for the assigned work.

Do not rely on the original chat transcript when the decision has been archived in GitHub.

## Convex Builder Agent team

Only agents assigned to Convex/backend/agent-runtime build, review, verification, or publication work use the dedicated workflow:
`interplanetary-fund-agent/handoffs/CONVEX_BUILDER_AGENT_WORKFLOW.md`

That workflow is **not** a universal workflow for unrelated project agents.

Required sequence:
`Agent 1 implementation → Agent 2 review → Agent 1 correction → Agent 3 independent verification → publication`

If review or verification fails, findings return to the implementation loop. No failed inspection is final approval.

## Communication and continuity

Agents communicate through durable GitHub artifacts: issues, PR descriptions, review comments, handoff documents, audit records, and commits.

Before implementing, determine whether another agent is already working on the same scope. Do not create competing implementations unknowingly.

Every meaningful handoff must identify the repository, PR/commit, work performed, evidence, findings, tests/checks, remaining uncertainty, and exact next action.

## Evidence rules

- Static inspection is not runtime proof.
- Historical or simulated events are not current runtime proof.
- Never claim a provider integration, automation, financial operation, or deployment is functional without appropriate evidence.
- Preserve auditability and source provenance.

## Source-of-truth rules

Convex is authoritative for persistent agent identity, permissions, working/long-term memory, outcomes, campaigns, protocol, treasury, payments, and scheduled intelligence. Base44 may mirror selected state for application display and bridge interactions into Convex; it must not create a competing production source of truth.

## Security and correctness

Prioritize authorization, least privilege, financial integrity, idempotency, concurrency, auditability, privacy, and rollback. Do not bypass existing permission or human-approval requirements.

## Continuity rule

When a genuinely new project decision is made, record it in the appropriate canonical GitHub document and update dependent reference material. The goal is that future agents can continue without requiring the project owner to repeat established context.
