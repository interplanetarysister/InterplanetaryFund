# Interplanetary Fund — Project Context Archive

**Purpose:** Durable project memory for future agents and continuation work.
**Last updated:** 2026-08-23
**Important:** This is a project-decision archive, not a verbatim transcript of every conversation. New authoritative decisions should be added here or in the appropriate role-specific GitHub document.

## 1. Canonical architecture

- `interplanetarysister/interplanetary-fund2` is the canonical user-facing Base44 application.
- `interplanetarysister/InterplanetaryFund` is the authoritative Convex/backend and agent-runtime repository.
- `interplanetarysister/interplanetary-fund-backend` is legacy/reference unless explicitly assigned.
- `interplanetarysister/fundforge-ai` is an older Base44 application repository now reconciled for decommissioning; it is not a production source of truth.
- Base44 is the application layer; Convex is the authoritative backend/runtime and source of truth for persistent agent state and backend behavior.
- Vercel is hosting/deployment infrastructure and is not the definition of the project's Convex agents. Current GitHub inspection has not established Vercel as an essential active component of the current architecture.

## 2. Agent-team operating model

The project uses role-specific agents. **Do not assume every agent has the same instructions.**

The Convex Builder Agent team has a distinct workflow documented in:
`interplanetary-fund-agent/handoffs/CONVEX_BUILDER_AGENT_WORKFLOW.md`

The intended coordinated sequence is:

1. Agent 1 implements.
2. Agent 2 independently reviews the actual implementation.
3. Agent 1 corrects Agent 2 findings when required.
4. Agent 3 independently verifies the resulting exact head.
5. Only after the applicable final gate passes is the work ready for publication/merge.

A failed inspection must feed findings back into the implementation/review loop. Verification is not a one-way stop.

## 3. Agent communication rules

- Do not have multiple agents unknowingly implement the same change.
- Before starting, inspect the current issue/PR, current head, existing handoffs, and recent findings.
- Reviewers must record concrete evidence and next actions.
- A final reviewer must inspect the resulting/current head, not rely on an earlier revision.
- Runtime proof must come from the appropriate environment/evidence; static inspection or simulated/historical events must not be represented as current runtime proof.
- Preserve an audit trail in GitHub.

## 4. Project priorities already established

- Stabilize the agent runtime and Convex concurrency before expanding autonomous work.
- Preserve authoritative source-of-truth boundaries between the Base44 application and Convex backend.
- Treat security, authorization, financial integrity, idempotency, and concurrency as high-priority correctness areas.
- Do not silently introduce competing backend systems when an established authoritative Convex path exists.
- Historical repositories/capabilities may be recovered as specifications, but must be deliberately reviewed before being promoted into current production behavior.

## 5. Repository reconciliation decision — 2026-08-23

Do **not** copy the entire internal-agent repository into `interplanetary-fund2`. Instead, each repository owns the material required by its role:

- `InterplanetaryFund` owns internal-agent identity, orchestration, memory/permissions, Convex/backend runtime, internal protocols, audits, handoffs, and the portable internal knowledge base.
- `interplanetary-fund2` owns the user-facing Base44 application, frontend, application entities/configuration, application-layer agents, and application-specific workflows.
- `interplanetary-fund-backend` remains legacy/reference material.
- `fundforge-ai` has been reconciled against the current application and is no longer needed as an active production source; its history should be preserved for reference.
- Shared architectural decisions are referenced across repositories through explicit source-of-truth documents rather than duplicated wholesale.
- The internal-agent reference index is `docs/REFERENCE_MATERIAL_INDEX.md`.
- The application-side boundary guide is `interplanetary-fund2/docs/REPOSITORY_SOURCE_OF_TRUTH.md`.
- The FundForge decommission handoff is `fundforge-ai/docs/DECOMMISSION_HANDOFF.md`.

This is a **reconciliation**, not a destructive consolidation. Historical evidence remains preserved.

## 6. FundForge reconciliation — 2026-08-23

`interplanetary-fund-ai` was reviewed as the owner-scoped FundForge repository (`interplanetarysister/fundforge-ai`). It is an older Base44 app. Its campaign/application features overlap with and are superseded by the current `interplanetary-fund2` application, which contains the corresponding campaign area plus expanded current AI, health, funding, cross-platform, and outreach functionality.

The reconciliation found no identified FundForge AI feature that blocks decommissioning it as a production application source. The repository should be **archived rather than immediately destroyed**, after confirming there is no still-needed external Base44 app/deployment or service connected to it. Permanent deletion should be a later explicit decision so its Git history remains recoverable.

Agents must not begin new production work in FundForge AI. If historical code is needed, cite its path/commit and migrate only the required capability into the current canonical repository after review.

## 7. Existing review/verification expectations

Open work has repeatedly established the following pattern:

- Agent 2 + Agent 3 audit new or security-sensitive work.
- Agent 1 addresses validated findings.
- Agent 3 performs final publication review.
- Required CI, focused verifiers, typecheck/build, and runtime validation are performed when applicable.
- Draft PRs should remain draft until their stated review gates are satisfied.

## 8. Important project history to preserve

The project evolved from Base44/FundForge-era fundraising work into a broader Interplanetary Fund architecture. Historical FundForge material may contain capabilities worth recovering, but it is evidence/specification rather than automatic production truth.

The project has also investigated and repaired issues involving:
- agent automation authorization;
- admin credential/bootstrap security;
- communication audit-record integrity;
- financial/donation integrity;
- Convex automation concurrency and overlapping writers;
- platform event contracts and idempotency;
- opening-agreement liability wording;
- repository/source-of-truth governance.

These areas should be checked for existing GitHub issues/PRs before opening duplicate work.

## 9. User/project interaction preference captured for agents

The project owner should not have to repeatedly restate established architecture, role boundaries, workflow, or decisions. Agents should consult this archive and the role-specific documents first. If a genuinely new decision conflicts with this archive, record the new decision explicitly rather than silently replacing historical context.

## 10. Current continuation point — 2026-08-23

The immediate objective is to finish preparing the coordinated Convex Builder Agent workflow and its durable handoffs, then allow the assigned agents to work through GitHub in the established review/correction/verification loop.

The repository/reference reconciliation has now been established in the canonical documentation. Remaining implementation work should use that source-of-truth map and update dependent reference material when decisions change.

Do not interpret this archive as permission to bypass security, review, runtime validation, or repository ownership controls. It exists to preserve context and reduce repeated questions, not to weaken project safeguards.
