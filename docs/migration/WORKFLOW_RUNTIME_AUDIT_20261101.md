# Workflow and agent runtime audit — 2026-11-01

Read-only inspection of the live Supabase destination `ssibsfmtodgximseeqsv` and Cloudflare account.

## Supabase workflow state

The following operational tables are present in `ifund_ops`:
- `workflow_jobs`
- `workflow_control`
- `workflow_execution_log`

All three returned zero rows. There are currently no queued workflow jobs, no workflow control rows enabling execution, and no execution log entries in this destination project.

## Cloudflare Worker state

| Worker | Cron schedules | Runtime bindings | Secret bindings |
|---|---:|---:|---:|
| `ifund-workflows` | 0 | 0 | 0 |
| `ifund-workforce` | 0 | 0 | 0 |
| `ifund-oauth` | 0 | 3 (D1 + 2 plain-text settings) | 0 |
| `interplanetary-fund-api-migration` | Not configured | 1 preview flag | 0 |

The `interplanetary-fund2` Worker still has Base44-origin configuration and a publishable Supabase key binding; it has no secret bindings. This is not an independent, fully configured runtime.

## Staged source records

The source import batches for agent activity and delegation contain 397 and 26 imported rows respectively, but both batches remain `pending`. This is staged data, not active agent conversation/history or a running agent executor. The source inventory describes 10 agent definitions and 17 workflow definitions; no runtime parity is established by those definitions alone.

## Activation requirements

Before enabling any workflow or agent:
1. Reconcile the source data and owner identity links.
2. Port each workflow's trigger, payload contract, authorization, idempotency, retry/lease, and audit behavior.
3. Configure only required free-tier bindings and secrets after checking provider ownership and cost.
4. Verify the executor against synthetic fixtures and safe read-only actions.
5. Verify queue claims, lease fencing, retries, duplicate suppression, and failure handling.
6. Enable one workflow at a time and confirm logs before enabling another.

No bindings, secrets, cron triggers, workflow controls, jobs, agent data, or provider settings were changed.
