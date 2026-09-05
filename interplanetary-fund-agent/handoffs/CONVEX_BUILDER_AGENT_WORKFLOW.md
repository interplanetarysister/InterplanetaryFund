# Convex Builder Agent Workflow

**Status:** Authoritative project workflow
**Scope:** Only agents that are assigned to build, review, verify, or publish Convex/backend/agent-runtime work for Interplanetary Fund.
**Do not apply this document to every agent in the project.** Agents outside this scope should follow their own role-specific instructions.

## Purpose

This document defines the coordinated workflow for the Convex Builder Agent team. The agents must work as a pipeline, not as independent competing implementers.

## Repository ownership

- `interplanetarysister/InterplanetaryFund` — authoritative Convex/backend and agent runtime.
- `interplanetarysister/interplanetary-fund2` — canonical user-facing Base44 application.
- `interplanetarysister/interplanetary-fund-backend` — legacy/reference backend; no new production backend work unless explicitly assigned.

## Roles

### Agent 1 — Convex Builder / Implementer
- Finds assigned implementation work in GitHub.
- Implements the requested correction or feature in the authoritative repository.
- Reads Agent 2 and Agent 3 findings before starting related follow-up work.
- Records implementation decisions, tests, limitations, and handoff information in GitHub.
- Does not declare its own work finally verified.

### Agent 2 — Reviewer / Security & Correctness Auditor
- Reviews Agent 1's actual implementation/head.
- Checks security, authorization, data integrity, concurrency, architectural consistency, and regression risk as applicable.
- Does not overwrite Agent 1's work merely to make the review pass.
- Records concrete findings and required corrections in GitHub.
- If verification fails, the failure becomes an explicit handoff back to Agent 1 with enough evidence to investigate the discovered behavior.

### Agent 3 — Independent Verification / Publication Gate
- Reviews the resulting implementation after Agent 1 has addressed Agent 2 findings.
- Verifies the exact current commit/PR head, not an earlier revision.
- Performs independent final checks, including applicable tests, build/typecheck/security/runtime evidence, and repository/process requirements.
- If verification fails, records the failure and routes the work back for correction rather than treating the failed inspection as final.
- Only Agent 3's successful final gate may mark the change ready for publication/merge under the project's established review policy.

## Required communication loop

`Agent 1 implementation → Agent 2 review → Agent 1 correction (if needed) → Agent 3 independent verification → publication`

A failed Agent 2 or Agent 3 verification must create a traceable feedback loop. The reviewer must state what was found, where it was found, why it matters, and what evidence is required for re-verification.

Agents must communicate through durable GitHub artifacts (PR descriptions, review comments, issues, audit documents, and commits) so another agent can continue without relying on private conversation history.

## Three-attempt recovery rule

This rule applies to Agent 1, Agent 2, Agent 3, Codex agents, and workflow-driven agents operating under this workflow.

An agent must not repeat the same specific action indefinitely. After **three unsuccessful attempts at the same specific action**, stop retrying that unchanged action. Record the attempts and the available failure evidence in the relevant GitHub artifact, then do one of the following:

1. **Repair the cause:** investigate and correct the underlying code, configuration, dependency, workflow, test, permission, integration, or environment problem before attempting the action again; or
2. **Move to another actionable task:** when the blocker cannot presently be repaired by that agent, leave a precise handoff/blocker record and begin the next valid task within the agent's assigned scope.

Changing only superficial parameters or repeatedly re-running an unchanged known-broken workflow does not reset the three-attempt count. A materially repaired underlying cause may begin a new attempt cycle. This recovery rule does not permit bypassing security, authorization, review, verification, or human-approval gates.

## No duplicate work

Before starting work, the assigned agent must inspect the relevant GitHub issue/PR, current branch/head, existing agent handoff documents, and recent findings. If another agent is already working on the same scope, coordinate through GitHub rather than creating a competing implementation.

### Edit the existing produced work — do not rebuild from scratch

When a builder agent is correcting, extending, or improving work that has already been produced, it **must modify the existing implementation/artifact in place** rather than recreating an equivalent implementation from scratch. Preserve the existing work, history, architecture, interfaces, and valid functionality unless the GitHub task explicitly requires replacement.

Before making changes, identify the exact current artifact/commit/PR head that is the subject of the work. Apply the smallest coherent modification that satisfies the requested correction. Do not discard a prior implementation and regenerate it merely because regeneration is easier.

If a true replacement or rewrite is necessary, the agent must document why the existing produced work cannot safely be edited, what will be preserved, and how equivalence/regression will be verified. A replacement must be explicitly justified in the GitHub handoff/review record.

This rule applies to code, configuration, documentation, schemas, agent definitions, workflows, prompts, generated assets, and other produced project artifacts.

## Verification principle

Static inspection alone must not be represented as runtime proof. When runtime behavior is required, the workflow must identify the required environment and evidence. Historical/simulated events must not be presented as proof of current runtime behavior.

## Current architecture rule

Convex is the authoritative backend/runtime for persistent agent identity, memory, outcomes, campaigns, protocol, treasury, payments, and scheduled intelligence. Base44 may mirror selected state for the application layer but must not become a competing production source of truth.

## Completion rule

A task is not considered complete merely because code exists or a PR is open. It is complete only when the applicable implementation, review, correction, verification, and publication gates have been satisfied and documented.

## Durable handoff requirement

Every meaningful handoff should state:
1. What changed or was investigated.
2. Exact repository and relevant PR/commit.
3. Findings and severity.
4. Tests/checks performed and their results.
5. Remaining uncertainty or runtime validation needed.
6. Exact next action for the receiving agent.

This workflow is intentionally scoped to the Convex Builder Agent team; it is not a universal instruction for unrelated project agents.
