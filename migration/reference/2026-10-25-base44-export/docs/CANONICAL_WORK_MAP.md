# IFund Canonical Work Map

This file is the durable routing table for project work. Search it before creating issues, branches, PRs, workflows, verifiers, documents, functions, components, entities, or replacement implementations.

| Responsibility | Canonical tracker | Primary locations |
|---|---|---|
| Security, authorization, privacy, RLS | #477 | `base44/functions/`, `base44/entities/`, security verifiers |
| Payments and financial integrity | #478 | payment functions, donation/withdrawal entities, payment verifiers |
| Connections and external platforms | #479 | `src/pages/Connections.jsx`, connection components, integration functions/registry |
| Social, distribution and communications | #480 | social components, publish/broadcast functions, inbox/notification paths |
| Runtime, CI and deployment | #481 | `.github/workflows/`, runtime scripts, `wrangler.jsonc`, worker |
| Base44 sync, portability and source of truth | #482 | `AGENTS.md`, syncGitHub/checkpoints, portability contracts |
| UX, mobile and accessibility | #483 | shared layout/styles, pages/components, UX regression contracts |
| AI, agents and automation | #484 | agent/LLM functions, secure LLM gateway, agent contracts |
| Data, schema and reliability | #485 | entities, data boundaries, idempotency/concurrency verifiers |
| Product and future features | #486 | product backlog and intentionally deferred/future capabilities |

## Mandatory discovery order

1. Read `AGENTS.md` and this map.
2. Search current `main` for the capability, symbol, route, entity, workflow, verifier, and documentation.
3. Search the canonical tracker above and its consolidated historical issue references.
4. Search open PRs and existing branches for unmerged work.
5. Extend the existing canonical artifact when it exists.
6. Create a new location only when the existing location cannot safely own the responsibility, and document why.

## Duplication controls

- Do not create `current-main`, date-suffixed, `v2`, retry, run-number, or agent-number variants merely to continue existing work.
- One responsibility has one active tracker. Historical issues stay closed and searchable.
- One logical implementation batch should normally use one branch and one PR. Small authorized direct-main batches should normally be one commit.
- Do not rewrite published `main` history merely to reduce historical commit count.
- Closed PRs and issues are evidence, not active instructions. Current `main`, `AGENTS.md`, this map, and the canonical tracker control.
- Before deleting an old branch, prove its unique commits are already in `main` or intentionally preserved elsewhere.
