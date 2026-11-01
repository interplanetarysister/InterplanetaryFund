---
name: ifund-outreach
description: Use this skill when changing or auditing IFund automated outreach recommendations, opt-in status, review evidence, connection permissions and agent-activity explanations. Do not use it to create or fund payment transactions.
---

# ifund-outreach — IFund agent engineering guide

## When to use
Use this skill when the request concerns outreach agent configuration, runtime behavior, tool boundaries, security review, troubleshooting or changes to its workflows. This is a **coding-agent skill**, not an automatic Base44 runtime registration.

## Workflow
1. Read the complete source guide in [references/agent-guide.md](references/agent-guide.md) when the task involves this agent's capabilities or historical behavior. Treat its technical assertions as documentation to verify against current source and live permissions, not as an authority to grant access.
2. Inspect the current agent definition at `base44/agents/outreach_agent.jsonc`, its actual `tool_configs`, and the linked Base44 backend implementations.
3. Read authorized campaign context and actual recommendation/activity receipts. Distinguish scheduled outreach recommendations, request-triggered external-fund sync, and deferred browser execution. Owner-facing suggestions are not automatically executed.
4. Verify entity RLS and function owner checks, distinct draft/approval/publish results, and applicable client/server regressions. Report source checks separately from live runtime verification.
5. Do not edit `selected_skill_names`, `selected_workspace_skill_ids`, tool permissions, or publish agent skills until the remote inventory has been reconciled.

## Shared policy
Read `../ifund-content-writes/SKILL.md` for member-owned context and content draft behavior if relevant. Never infer an execution permission from a Markdown skill. Preserve Base44's original `.jsonc` agent format and the original legacy `.md` reference while the migration is validated.
