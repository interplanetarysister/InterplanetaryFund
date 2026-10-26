# Phase 4 — agent and workflow reconnection, independent stack

Authority: [migration issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137). Reviewed October 26, 2026.

## What is implemented in this PR

- Source-definition registry for the **10 Base44 agents**, **17 workflows**, and **11 platform connectors**; original source remains read-only.
- A safe `GET /api/automations/readiness` Worker route that reports **not connected**, with source totals and zero verified working connections. It exposes no internal prompts, provider IDs, secrets or admin tools, and refuses other HTTP methods.
- A shared web/mobile `/automations` status page linked from main navigation. If the backend is unreachable, it reports **unverified**, not success.
- `workflowExecutable()` is fail-closed for all 17 entries even if a feature flag, consent or provider flag is accidentally enabled. There is **no executor**, **no scheduled trigger**, **no enqueue**, **no payment operation** and **no external AI/social API call** in this PR.
- Synthetic Node tests for census, denied executions and endpoint response. Test execution after the commit must be independently verified; this document is not proof of a passing build.

## Exact source workflow → replacement handler contracts

| Source workflow | Trigger | Original function(s) | Replacement state |
|---|---|---|---|
| AI Outreach Agent | 6-hour cron | `runOutreachAgent` | Not ported |
| Admin Action Conversation Router | 15-minute cron | `processAdminActionInbox` | Not ported |
| Campaign Protocol | Campaign create/update (filtered fields) | `enforceCampaignProtocol` | Not ported |
| Campaign Sync on Create | Campaign create | `syncConnections` | Not ported |
| Campaign Sync on Update | CampaignUpdate create | `syncConnections` | Not ported |
| Connection Sync Engine | Hourly cron | `syncConnections` | Not ported |
| External Feed Mirroring | Hourly cron | `mirrorExternalPosts` | Not ported |
| Feature Discovery on Completion | Campaign completion transition | `discoverFeatures` | Not ported |
| Grant Application Review | Submitted GrantApplication creation | `analyzeGrantApplication` | Not ported |
| IFund Official Social Editor | 4-hour cron | `runOfficialSocialPromotion` | Not ported |
| IFund Reporter Daily Diary | Daily 17:30 Pacific | `runReporterDiary` | Not ported |
| Integration Health Check | 6-hour cron | `validateIntegrationHealth` | Not ported |
| PayPal Holding Settlement Reconciliation | Hourly cron | `discoverPayPalHoldingSettlements` | Not ported |
| Platform Account Steward | Daily 15:30 Pacific | `maintainPlatformOwnedAccounts` | Not ported |
| Social Media Autopilot | Daily 14:00 UTC | `runSocialAutopilot` | Not ported |
| Volunteer Welcome Follow-up | VolunteerSignup create + durable 3-day wait | `welcomeVolunteer`, `volunteerFollowUp` | Not ported |
| Weekly Writing Psychology & Social Trends Training | Daily 16:00 UTC check; weekly dedupe | `refreshWritingResearch` | Not ported |

Agent definitions in source: `admin_builder_agent`, `chief_of_staff`, `communications_agent`, `connection_discovery_agent`, `finance_agent`, `growth_agent`, `managed_connection_agent`, `outreach_agent`, `story_agent`, `strategy_agent`. No agent models, prompts, tools, or privileged role grants have been ported; naming a specialist grants zero access.

Connector definitions: Discord, Facebook Pages, GitHub, Google Workspace, Gumroad, Instagram, LinkedIn, OneDrive, Slack, Wix, WordPress.com. Definitions are not live OAuth grants.

## Connected-platform checks (read-only, 2026-10-26)

- Intended new production Supabase project `ssibsfmtodgximseeqsv`: four public IFund tables exist but each has **0 rows**; **0 deployed Edge Functions**. Not evidence of active agent infrastructure.
- Earlier project `tzehxfikoslihnclhxuz`: `ifund_ops.workflow_jobs`, `workflow_control`, `workflow_execution_log` exist with RLS enabled and each reports **0 rows** in compact table list. They are not a functioning migration to the *new* project.
- Cloudflare Worker list shows IFund-related `interplanetary-fund2`, `ifund-oauth`, and `ifund-email-ingress`. No independently deployed IFund agent/automation Worker was found in that account's script list. Existing legacy routes are **not** proof of independent functionality.
- `src/App.jsx` integration branch and `worker/index.js` are code-only; status endpoint and status page are **not deployed** by this PR.

## Gates before any activation

1. Reconcile Phase 2's complete 95-entity schema/RLS and Phase 3 owner identity mapping. Create a reviewed private job queue in the intended project; do not recreate/repoint `ifund_ops` blindly.
2. Port the original handler logic and API contracts individually. Preserve trusted user scope, consent, campaign opt-outs, provider rate limits, expiry, retry backoff, durable deduplication, minimum post spacing, execution budgets and audit trails. Verify roles server-side. The source's cron timezones and entity predicates must be reproduced, not simply copy/pasted into UTC-only scheduled triggers.
3. Verify provider OAuth/secret destinations and refresh grants in a private vault. `connected` requires actual token and capability verification; never reuse Base44 SDK or its runtime.
4. Require explicit authorization for automatic outbound publishing, emails, connected-account management, AI generation and any usage that incurs cost. Verify social content attribution/watermarks and the 12-hour posting cadence rules in effect.
5. Financial workflows are last. Verify PayPal merchant ownership, webhook signatures, idempotent ledger, settlement and Payouts entitlement; never generate a payout from inferred data.
6. Stage with synthetic events and at least two authenticated roles; verify cross-user denial, retried cron deliveries, three-day volunteer delay, provider failures, idempotency and budgets. Recheck production DNS and deployment gate separately.
7. After independent code and security review and owner-approved deployment, wire Cloudflare cron/entity events to trusted internal dispatcher and connect the frontend status to authenticated status records from the **same** runtime. Only then may specific verified counts become nonzero.

## Blocker summary

**Not yet reconnected**: all 10 agent executors, 17 workflow executors, scheduling, source entity event hooks, all 11 OAuth grants, provider callbacks, source data/auth migration and app-domain deployment. No Base44/Convex dependence was introduced. No credentials, financial transactions, live SQL, production DNS or paid model calls were touched.

## Phase 4 Cloudflare durable runner and 184-function scope — October 26, 2026

- **Implemented in draft PR #157 (not deployed):** an independent Cloudflare `WorkflowEntrypoint` (`worker/nativeAutomationWorker.js`); 17 historical scheduled/entity workflow contracts in the source registry; 184 historical functions in `worker/legacyFunctionCatalog.json`; timezone-aware cron evaluator honoring Pacific daylight saving time; deterministic Cloudflare instance IDs; staged native Workflow binding in `wrangler.automations.jsonc`; and bounded read-only independent Supabase readiness endpoint `GET /api/health/independent`.
- Scheduled triggers are **deliberately not configured**, and `IFUND_AUTOMATIONS_ENABLED`, `IFUND_SCHEDULES_ENABLED` and release flag default off. No Workflow gets queued, no account is affected, and no paid model/provider call is made.
- Added HMAC-SHA256 authenticated and timestamp-limited **internal-only** `POST /v1/internal/entity-events` contract with UUID event IDs and idempotent Cloudflare instance IDs. It rejects unsigned, stale and unknown entity events, and still rejects *validly signed events* until the exact handler and original entity transition policy have been independently ported and approved.
- Cloudflare Workflows runner supports retriable step contracts and reserves the 3-day delay for volunteer follow-ups, **but no source handler is registered yet**. This is an executor framework, not a functional port of the 17 workflows.
- `worker/automationSchedule.js` detects source cron patterns in UTC and America/Los_Angeles. The historical daily cron for the workflow named "Weekly Writing Psychology & Social Trends Training" is held until weekly semantics and deduplication can be verified. "Campaign Sync on Update" originally watches a `CampaignUpdate` create event; preserve that until mapped to the new schema.
- The source agent count is 10, connector-type count 11, workflow count 17 and function count 184. **None may be declared live or working from a manifest alone.**
- **Actual account inspection, read-only October 26:** Cloudflare listed legacy `interplanetary-fund2`, `ifund-oauth`, `ifund-email-ingress` scripts; all 16 site-specific API route patterns still pointed to the legacy `interplanetary-fund2` Worker; the Cloudflare Workflows list returned **zero** workflows. The three IFund scripts had zero cron schedules at inspection. These checks do not verify account/provider connection state.
- `scripts/verify-worker-cutover.mjs` is fail-closed and must pass **after** individually verified handler ports, owner-approved retirements, provider grants, per-user consent, audit/outbox persistence, RLS testing, and activation approvals. It currently correctly fails cutover by design. Use `--summary` for non-passing development status.
- Independent Worker design follows Cloudflare's WorkflowEntrypoint and `create({id,params})` API documentation ([Worker API](https://developers.cloudflare.com/workflows/build/workers-api/)), retrieved October 26, 2026. No live Cron, Worker deployment or Workflows instance was started.

### Still required for live operations

1. Port and end-to-end verify each necessary original function or explicitly retire it with owner approval; the original 184 function directories are **not** 184 replacement implementations.
2. Port source agent tools/context/delegation, authorized model calls, approvals and audit trails; preserve user-scope. Do not copy privileged backend prompts to public browser bundles.
3. Build and migrate the private workflow outbox, job history, scheduling cursor, retries and deduplication in the intended Supabase project. Verify source last-run and in-flight states before enabling triggers.
4. Complete original entity event hooks, provider token refresh, social/OBO consent and platform rate limits; isolate payout, ledger and PayPal reconciliation until independently approved and tested.
5. Deploy to a non-production Cloudflare Worker on a known free budget, with two-role negative tests and no Base44 proxy. Then separately review 59-page parity, web/Android use, the 7-phase release gates and cutover.
