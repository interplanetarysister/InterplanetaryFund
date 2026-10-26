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
