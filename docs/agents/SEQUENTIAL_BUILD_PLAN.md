# IFund agents and workflows: sequential implementation contract

Baseline checked November 3, 2026 (Los Angeles). Tracking issue: #137.
Implementation: `interplanetarysister/InterplanetaryFund`, canonical frontend `apps/web`.
Reference-only PR: https://github.com/interplanetarysister/interplanetary-fund2/pull/545
Auth overlap reviewed: https://github.com/interplanetarysister/InterplanetaryFund/pull/207

The reference PR stages definitions and inspection endpoints. It explicitly leaves authentication, execution adapters, durable state, duplicate protection and live parity unimplemented. It must not be deployed or merged into the destination wholesale. This change adapts the first runtime in the implementation repository.

## Verified hosted baseline

- Cloudflare account `c95db4f2c901f32776471b85f1eda15d` owns the IFund resources.
- `ifund-workforce` is a read-only catalog; it has no AI, Durable Object or Workflow binding.
- `ifund-workflows` has a scheduled handler and Supabase bindings, and owns `/api/workflows/*` routes. It is an existing custom job runner, not a Cloudflare Workflows resource. No Cloudflare Workflows resources were listed. Preserve its existing work and financial isolation.
- Pages `interplanetaryfund-migration` now points to the correct `InterplanetaryFund` repository with root `apps/web`. Earlier reports that its source still points to fund2 are stale. Automatic production deployment remains disabled; selected preview branches are enabled.
- Canonical Supabase is `ssibsfmtodgximseeqsv`. Legacy `tzehxfikoslihnclhxuz` is separate.
- All three existing profiles are active and not deletion-pending. A trusted Auth insert trigger already creates active independent-signup profiles. Do not recreate that trigger or assign legacy identities by matching email.
- Agent draft, activity, conversation and delegation tables exist with RLS and no browser policies. Operational `ifund_ops.workflow_jobs` already has unique workflow/event keys, leases and bounded attempts. No duplicate job store is needed. At inspection it had zero jobs and zero agent drafts. The research table had zero rows.
- Supabase advisors report deny-by-default tables without policies. This is expected for dormant imports; do not grant blanket browser access to make an agent work.

## One completion gate per agent

An agent is complete only after its source tools, entitlement checks, owner/campaign scope, truthful outputs, correction and memory semantics, secret handling, approval boundaries, retries/idempotency, audit receipts, UI/mobile states, live provider/database behavior and rollback pass independent review. Imported configuration and passing builds alone do not meet this gate. Keep actual completion evidence separate from implemented code.

| Order | Agent               | Required behavior and dependencies                                                                                                                                                                                                                                                                   |
| ----- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Story               | Verified member draft writing, five titles/two summaries/story, section revisions, mission-specific visual direction, current owned campaign and account context, verified research, owner-scoped draft management, memory correction and specialist routing. No agent self-approval or publication. |
| 2     | Strategy            | Evidence-based campaign plans and preferences, owner-controlled scheduling, actual specialist delegation receipts; needs verified Story gate.                                                                                                                                                        |
| 3     | Growth              | Canonical aggregate analytics and verified-outcome recommendations; no invented metrics.                                                                                                                                                                                                             |
| 4     | Communications      | Owner-scoped inbox/notifications, drafts and reply consent; provider receipts for delivery.                                                                                                                                                                                                          |
| 5     | Managed Connections | Verified OAuth grants, secure token storage/refresh/revocation, provider capability and repair checks.                                                                                                                                                                                               |
| 6     | Discovery           | Authorized research and connection discovery with source provenance, bounded requests and permission-safe handoff.                                                                                                                                                                                   |
| 7     | Outreach            | Consented per-destination publishing, draft/ask/manual/auto controls, deduplication, provider limits and real delivery receipts.                                                                                                                                                                     |
| 8     | Finance             | Verified read models, reconciliation and reporting; no autonomous payouts. Provider round trips and separate payment approval gates are mandatory.                                                                                                                                                   |
| 9     | Chief of Staff      | Owner-scoped coordination of completed specialists, bounded delegation without recursive/self routing, status based on actual receipts.                                                                                                                                                              |
| 10    | Admin Builder       | Verified administrator-only diagnostics and reviewable changes; no privilege expansion, secrets in prompts or automatic production release.                                                                                                                                                          |

`sequential-build-ledger.json` records all ten source definitions, their exact hashes/tool names, and all 17 workflow definitions including conditions, arguments, transitions, delays, schedules and timezones. These snapshots are reference evidence, not executable permission grants.

## Cloudflare responsibilities

- Existing Pages frontend with authenticated same-origin Pages Functions proxy to a dedicated Story Worker service binding. No production route replacement for the first increment.
- Story Worker validates JWTs with canonical Supabase Auth and calls guarded RPCs with the same JWT. No service-role secret, user token in URL, or user JWT persisted in job payloads.
- Workers AI is opt-in, with a database-serialized maximum of two Story requests per UTC day across this platform. Failed or interrupted requests still consume the allowance. Existing account usage/free allowance must be verified before enabling; the quota does not prove the whole account is free.
- Operational jobs are reserved before inference; concurrent duplicates return in-progress, successful retries return the persisted draft, changed input under the same key conflicts. Unknown/crashed calls are not automatically inferred again. A new request is a deliberate user action and remains quota-limited.
- Future durable Cloudflare Workflows should carry job references, not user access tokens. They require a scoped server-side execution identity, canonical per-owner rechecks, service bindings and provider-specific idempotency before activation. Do not turn the 17 JSON definitions directly into a generic eval/execution engine.

## Supabase responsibilities

- Preserve canonical Auth/profile/verified owner mappings, legal acceptance, RLS and private provider credentials.
- Reuse `ifund_agent_content_draft`, `ifund_agent_activity` and `ifund_ops.workflow_jobs`; narrow guarded RPCs expose only this adapter's own owner-scoped drafts. Existing imported records retain their current access rules. The SQL is staged under `docs/agents/sql/` and has an independent disabled database control. Its suggestions are tagged `ifund_story_v1`; the multi-option payload is preview-only and must never be passed to generic source apply/publish handlers. Normalize explicitly accepted owner choices before adding any application path. No SQL was applied.
- Keep privileged implementations in a non-exposed private schema with explicit authenticated actor, confirmed-email, active-account and versioned-consent checks. Public wrappers are security-invoker functions. Browser roles gain no direct table writes, job leases, publication or financial rights.
- Reconcile subscription entitlements before research/full agent-chat access, account-context projection before reporting connections, and scoped historical memory export/deletion before claiming memory parity.
- Extend canonical workflow queue/control/logs for the 17 workflows, preserving exactly-once effects, delayed follow-ups, dead letters, replay controls and real provider receipts. Reconcile with the existing job runner rather than creating competing queues.

## Workflow order and gates

1. Read-only Integration Health Check, then Campaign Protocol and Feature Discovery on Completion.
2. Campaign Sync on Create/Update and Connection Sync Engine after provider ownership/consent is verified.
3. Research training and Reporter Daily Diary after evidence provenance and publication review are implemented.
4. AI Outreach, Official Social Editor, Social Media Autopilot and External Feed Mirroring after completed outreach/connection agents and per-provider authorization.
5. Admin Action Conversation Router and Platform Account Steward after verified administrative access and approval audit.
6. Volunteer Welcome Follow-up must retain its three-day durable delay and email consent. Grant Application Review requires its canonical application access rules.
7. PayPal Holding Settlement Reconciliation remains segregated until verified provider events, ledger invariants and payment acceptance pass. A schedule must never fabricate settled funds.

This is planning for future agents/workflows only; no next agent starts while Story remains incomplete.

## Auth repair and remaining hosted verification

Dedicated confirmation callback supports PKCE codes, token-hash verification and legacy implicit links, validates the provider user, clears URL credentials and preserves safe returnTo. Signup adds password confirmation, resend and optional emailed-code verification. Password login remains available. Recovery accepts link or code without claiming a code was necessarily sent. Disabled providers remain hidden. Session/navigation checks require confirmed email.

The Supabase connector exposes no Auth settings mutation or test mailbox. Its URL allowlist, email templates/SMTP delivery, configured social providers and real two-browser password/confirmation/recovery round trips remain unverified. Required redirect routes: `/auth/callback` (including safe returnTo query) and `/reset-password` on canonical, www and the exact isolated Pages preview origin. Do not broaden to arbitrary preview wildcard origins or weaken email verification.

The default shell sandbox could not reach the configured proxy; read-only GitHub access succeeds with network sandbox escalation. Connected GitHub/Cloudflare/Supabase tools work. No Supabase management credential or authorized test mailbox is exposed to the shell. Do not bypass the configured proxy, request users' passwords in chat, assign new admin roles, or assert real login success from mocked tests.
