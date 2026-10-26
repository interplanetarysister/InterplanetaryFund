# Independent Cloudflare Worker and Workflows build checklist

Reference: [issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137) and [Phase 4 draft PR #157](https://github.com/interplanetarysister/InterplanetaryFund/pull/157).

## Verified runtime situation, 2026-10-26

The live Cloudflare account contains `interplanetary-fund2`, `ifund-oauth`, and `ifund-email-ingress`. Sixteen existing www/apex Workers route patterns for the domain still reference `interplanetary-fund2`. **The account's Cloudflare Workflows list contains zero deployed workflows.** No independent IFund automation Worker script is currently confirmed deployed. The live site's full readiness remains unverified.

## Code added independently

| Component | Responsibility | Deployment/execution |
| --- | --- | --- |
| `worker/index.js` | Existing safe campaign, community and owner-scoped API; plus readiness and independent backend probe | Code staged; do not repoint live routes |
| `worker/nativeAutomationWorker.js` | One native Cloudflare Workflows entrypoint shared by original 17 workflows | Code staged; not deployed |
| `worker/automationSchedule.js` | Match UTC and Pacific cron, including DST, deduplicate stable instance IDs | Pure module tests; no live schedules |
| `worker/automationEvents.js` | Signed/short-lived internal event hook and entity event contract | Disabled; no event-source grant |
| `worker/automationEngine.js` | Gate checks, retry step plan and volunteer delay, no unapproved adapter fallback | All 17 handlers blocked |
| `worker/legacyFunctionCatalog.json` | Exact 184 source function names and domains | All 184 need independent review |
| `wrangler.automations.jsonc` | Separate isolated Worker/Workflow definition with default disabled flags and no cron | Never deployed from this PR |
| `worker/independentHealth.js` | Separate auth-health reachability probe, without exposing keys or falsely reporting production parity | CI with fake upstream; live unchecked |
| `scripts/verify-worker-cutover.mjs` | A failing production release check until all ports/retires, workflows and activation gates pass | Must not be skipped |

The 10 original agents and 11 platform connector IDs are inventoried but their prompts/tool execution, OAuth grants and background operations are not installed. A source workflow name is **not** a functioning Cloudflare Workflow.

## Native Cloudflare trigger constraints

Cloudflare Cron is UTC. The source workflows specify `UTC` or `America/Los_Angeles`, so use a single quarter-hour platform schedule **only after** it has been approved, with `scheduledWorkflowsAt(event.scheduledTime)` evaluating each source rule in its own timezone. Do not add `triggers.crons` or turn on `IFUND_AUTOMATIONS_ENABLED` until real source handlers, source in-flight jobs, local wall-clock hour, idempotency and approved usage budgets have been reconciled. A workflow named weekly currently declares a daily cron, so its schedule must be resolved before activation.

For entity workflows, only a trusted independent server-side outbox may sign `timestamp + "." + raw_json_body` with a private 32+ character HMAC-SHA256 secret; provide the Unix timestamp in `x-ifund-timestamp` and hex HMAC in `x-ifund-signature`. Never put that secret in Vite/public env, GitHub, or frontend apps. Signed messages alone are not enough to execute while handler and release gates remain incomplete.

## Required verification before production

- All 184 functions independently mapped and reviewed (or individually retired), 17 workflows wired to real signed and durable backends, 10 agents and authorized provider grants validated.
- Supabase target `ssibsfmtodgximseeqsv`: private queue/outbox, owners/roles RLS, audit logs, replay/deduplication; source migration counts and audit proofs.
- OAuth and inbound mail kept separate; never point the 16 legacy routes at the unfinished Worker.
- PayPal Payouts eligibility, merchant ownership, webhook verification, clearing and ledger controls established before monetary automations. No unapproved spend or public-facing credentials.
- Sign-in and real data behavior verified on both web and Android, then release gate script passes and owner authorizes cutover.

**This architecture is staged code, not 17 running workflows or a migrated production service.**

## Further code implementation — October 26, 2026

- `worker/adminIntegrationHealth.js` now implements an authenticated **read-only** admin/super-admin provider-health endpoint. It validates bearer identity against the current Supabase Auth user endpoint, checks trusted `app_metadata.role` rather than user-editable metadata, optionally verifies a Cloudflare token using the provider's token verification API, and never reports PayPal/OAuth/social as connected without separate provider evidence. The service defaults off unless `IFUND_ADMIN_HEALTH_ENABLED=enabled` and the independent preview API environment is configured.
- `src/pages/Automations.jsx` exposes on-demand integration verification only in the administrator UI. The backend independently enforces the role. It receives only sanitized status strings—no credentials, account IDs or internal tool prompts.
- `worker/campaignWrites.js` enforces the **original Campaign Protocol minimum** for publishing an active campaign (positive goal, title, category, cover URL, story, summary), but preserves incomplete draft saving. The destination's live SQL constraint does not yet enforce the original cover requirement, so `docs/migration/sql/ifund_publish_protocol_review.sql` records an unapplied, review-only constraint to prevent direct database API bypass.
- `worker/automationAudit.js` adds an **independent private D1 audit-journal interface** using prepared, bound SQL statements and terminal-state protection. A D1 migration is included in `d1/migrations/0001_ifund_workflow_audit.sql`. The workflow runner now mandates an `IFUND_AUDIT_DB` binding before any verified workflow can run and journals start/success/failure through durable steps. Idempotent Cloudflare instance IDs are carried in both signed entity events and scheduled instances.
- **No D1 journal database has been created or bound**: read-only connected Cloudflare inspection found D1 databases `ifund-oauth` and `onlycryptids-media-scout`, neither an appropriate journal. Do not reuse their private data or create a new paid-capable resource without verified cost and isolation.
- Cloudflare Workers account reports usage model `standard`; Billing Read permission is unavailable through the current connection (403), so remaining no-cost capacity cannot be proven. Deployment, D1 provisioning, Cron activation and consumer traffic have **not** been performed.
- These changes add independent infrastructure and tests, **not** migrated real agency/workflow functionality. The core original 184 source functions remain unmapped to verified independent executors, all 17 workflows still have `ported:false`, and the new target Supabase RLS/public data remains unpopulated.

### Verification and critical gaps

Node tests and Vite build check protocol, status, audit logic and basic frontend; they **do not compile or remotely execute** the `cloudflare:workers` native Worker entrypoint, install D1 migrations, validate real OAuth/PayPal evidence, or prove end-to-end events across app and web. A dedicated isolated Worker dry-run/deployment test, real private D1 binding, account/role setup, signed event source and migration of original function handlers are still mandatory. No production traffic switch has been made.
