# IFund agent skill map and staged migration — 2026-10-11

## Decision and scope
The owner approved an incremental skill-creator-aligned correction. Preserve entire skills, pages, current login/RLS, existing agents, and their code/runtime formats. Do not activate a Base44 CLI full-sync, install connectors, alter billing, or deploy the site as a side effect of improving skill files.

## Two skill systems — never confuse their file formats
- **Coding-agent discovery**: `.agents/skills/<slug>/SKILL.md` (YAML `name` and `description`, core procedure, optional `references/` and `scripts/`). Valid for coding-agent instructions, **not evidence of live Base44 conversational agent installation**. The seven original `.agents/skills/<role>.md` guides remain at their original paths; exact copies are bundled under `<slug>/references/agent-guide.md` for discoverable reference loading. These two versions must stay byte-for-byte identical until the original references are deliberately retired in a later approved migration.
- **Base44 in-app agent skills**: `base44/agent-skills/<slug>.md` with YAML `description` and a body no longer than 15,000 characters, a different format from `SKILL.md`. This folder is intentionally **not created or pushed yet**: Base44's `agent-skills push` and the aggregate `deploy` replace the entire remote skill set. Creating a partial local set before reading/retaining every remote skill would put user-owned skills at risk. Required first: inspect the remote skills through an authorized read-only inventory, preserve exact IDs/content and references, then prepare a non-destructive reconciled complete set for separate review. Do not run `agent-skills push`, `agents push`, or `base44 deploy` until that inventory, diff and human approval exist.

## Coding-agent skill packages
| Role config (unchanged format) | Discoverable skill package | Original documentation |
| --- | --- | --- |
| `chief_of_staff.jsonc` | `ifund-chief-of-staff/SKILL.md` | `chief_of_staff.md` |
| `communications_agent.jsonc` | `ifund-communications/SKILL.md` | `communications_agent.md` |
| `finance_agent.jsonc` | `ifund-finance/SKILL.md` | `finance_agent.md` |
| `growth_agent.jsonc` | `ifund-growth/SKILL.md` | `growth_agent.md` |
| `outreach_agent.jsonc` | `ifund-outreach/SKILL.md` | `outreach_agent.md` |
| `story_agent.jsonc` | `ifund-story/SKILL.md` | `story_agent.md` |
| `strategy_agent.jsonc` | `ifund-strategy/SKILL.md` | `strategy_agent.md` |
| Shared content owner review | `ifund-content-writes/SKILL.md` | Same folder (existing) |
| Super-admin-only code building | `ifund-admin-builder/SKILL.md` | Same folder (existing) |
| Optional Wix engineering | `wix-base44-connector/SKILL.md` | Same folder with original `utils.cjs` and `references/CAPABILITY_MAP.md` |

The connector-discovery and managed-connection agents remain active with existing `.jsonc` configurations and shared content-skill wording; they have no dedicated legacy `.md` guide to wrap. Do not invent one until its actual role behavior is audited separately.

## Runtime access evidence and block
10 Base44 agent configuration files are present. The pre-change source baseline at `scripts/fixtures/ifund-agent-access-baseline.json` contains each agent's existing entity operations, function permissions, selected managed skills, selected workspace skill IDs, anonymous access and memory configuration. A static contract test requires exact preservation, apart from one approved removal of the retired `syncStripeSubscriptionCatalog` tool on `outreach_agent` (the backend stub returns 410 and remains in place for historical callers).

There are 12 distinct opaque `selected_workspace_skill_ids` across 37 assignments. Their remote identities/content and whether they are active in the current runtime are **unverified**. Managed skill names include `connections-webproxy`, `platform-connection`, and `failed-connection-recovery`. Preserve all those references, their exact order, and all permissions until an authenticated runtime inventory has been compared with the checked-in manifests.

A local Markdown skill is neither agent authorization nor a grant. Privileged tools must continue to validate the currently signed-in member or server-authenticated super-admin. No new tools were attached to user-tier agents. Source existence or a green build cannot prove remote skill execution.

## Verified narrow cleanup
- Wix `SKILL.md`: kept existing file and instructions, moved provider notice to *after* frontmatter so standard SKILL.md scanners can read the metadata. Kept its entrypoint `utils.cjs` unchanged. Removed only the identical, unreferenced `scripts/utils.cjs` duplicate; checked source references and identical bytes before deletion.
- Outreach: removed only the retired Stripe subscription catalog assignment, leaving the `syncStripeSubscriptionCatalog` 410 function stub and any historical finance audit route in place.
- Finance skill: replaced the misleading universal 2.9% + $0.30 checkout fee statement with a dynamic reference to `base44/shared/fees.js` and separate processor-specific defaults. Actual processor terms and verified ledger records are authoritative.
- Growth skill: clarified that a historical Stripe donation method is not current provider authorization.

## Explicitly untouched / important follow-ups
- The `getStripeIntegrationAudit` and `repairStripeWebhookEvents` admin functions are still listed as tools in the normal outreach agent. Their backends check administrator status. Recommend a **separate review** of whether those tools belong exclusively in a super-admin agent; not removed in this scope because only the retired catalog item was approved.
- `base44/workflows/External Fund Sync.jsonc` still describes a scheduled fund observation sync, which conflicts with the owner's request-triggered sync policy. This skill audit does not edit workflow scheduling. That separate runtime task requires an explicit code/workflow audit to preserve real-time donation and reconciliation processing.
- The existing `runBrowserConnection` backend still reports execution deferred. A skill must never claim it can finish a browser connection without confirmed execution.
- Wix live connector was reported active by Base44; local Node helper syntax and directory structure do not validate actual Wix API permissions or consent.
- No Base44 remote agent skills/permissions were synchronized, no site published, and no paid builder/agent workflow was started in this migration.

## Verification sequence
1. `node scripts/verify-ifund-skill-migration.mjs`: exact access baseline, all legacy guides still readable, skill package metadata, Wix retained helper, safe absence of partial Base44 in-app sync directory.
2. `node scripts/verify-agent-runtime-dependencies.mjs`, `node scripts/verify-agent-write-capabilities.mjs`, `node scripts/verify-platform-wide-repairs.mjs`: source-only capability/safety contract checks.
3. `node --check .agents/skills/wix-base44-connector/utils.cjs` and `npm run build`: local syntax and frontend regression compilation.
4. Before activation, inspect and back up **all** remote skills and agent tool/skill selections, then compare remote/local inventory; only after review test a nonproduction authenticated agent skill invocation. Preserve the exact original permissions and provide rollback.
