# Interplanetary Fund — Reference Material Index

**Effective:** 2026-08-23
**Purpose:** Tell internal agents where information belongs and which documents are authoritative, historical, or role-specific.

## Canonical architecture

- `docs/CANONICAL_REPOSITORY_ARCHITECTURE.md` — canonical repository ownership and source-of-truth boundaries.
- `docs/PROJECT_CONTEXT_ARCHIVE.md` — durable project decisions, architecture history, workflow decisions, and continuation state.
- `AGENTS.md` — internal-agent first-read order and runtime rules.

## Internal agent knowledge base

`interplanetary-fund-agent/` is the portable internal-agent knowledge base. Use the role-specific material rather than copying it into the application repository.

- `identity/` — agent identity and authorization context.
- `constitution/` — governing principles and authority boundaries.
- `instructions/` — standing operational instructions.
- `agents/` — agent registry and role information.
- `permissions/` — permission model and role scopes.
- `communications/` — internal/external communication architecture.
- `audits/` — audit records and verification history.
- `architecture/` — internal architecture references.
- `backend/` — Convex/backend architecture references.
- `capabilities/` — capability registry.
- `handoffs/` — agent-to-agent protocol and durable work handoffs.
- `completed-work/` — development history.
- `known-issues/` — known issues and limitations.
- `decisions/` — decision ledger.
- `requirements/` — project requirements.
- `testing/` — testing and verification procedures.
- `source-references/` — provenance and source references.

## Convex Builder Agent workflow

`interplanetary-fund-agent/handoffs/CONVEX_BUILDER_AGENT_WORKFLOW.md` is authoritative **only for agents assigned to Convex/backend/agent-runtime build, review, verification, or publication work**.

It must not be treated as a universal workflow for unrelated agents.

## Application repository references

`interplanetarysister/interplanetary-fund2` owns the user-facing Base44 application. Its application-specific instructions and docs remain there. Important current references include:

- `AGENTS.md` — application-layer instructions and repository boundary.
- `docs/AGENT_RUNTIME_UNIFICATION.md` — Base44↔Convex agent identity and memory bridge.
- `docs/IF_FEATURE_RECONCILIATION_2026-08-21.md` — evidence-based feature reconciliation baseline.
- `base44/agents/` — Base44 application agent definitions.
- `base44/entities/Agent.jsonc` — application-side Agent entity definition.

Do not duplicate the internal Convex agent knowledge base into `interplanetary-fund2`. Reference the authoritative internal documents instead.

## Historical/reference material

Date-stamped audits, discovery reports, reconstructed archives, migration plans, and legacy-repository material are evidence/specification unless explicitly promoted by a current decision. They must not override verified current implementation.

Examples include:
- `docs/AGENT_DISCOVERY.md`
- `docs/AGENT_ROSTER.md`
- `docs/IF_FEATURES_0.5-23_RECONSTRUCTED_ARCHIVE.md`
- `interplanetary-fund-agent/MIGRATION_PLAN.md`
- `interplanetary-fund-agent/PORTABILITY_ASSESSMENT.md`

Before creating duplicate work from historical material, check current issues/PRs and the project decision ledger.

## Update rule

When a canonical architectural or workflow decision changes:
1. Update the canonical document.
2. Update this index if ownership or location changed.
3. Update affected role-specific instructions/reference material.
4. Add the decision to `docs/PROJECT_CONTEXT_ARCHIVE.md` when it materially affects future work.
5. Leave historical evidence intact unless there is a deliberate archival/deletion decision.
