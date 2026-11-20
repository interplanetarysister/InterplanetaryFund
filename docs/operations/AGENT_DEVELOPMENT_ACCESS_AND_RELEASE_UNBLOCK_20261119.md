# iFund agent development access and release unblocking policy

Date: 2026-11-20. Status: development preflight implementation contract, **not** a production privilege change or verification claim. Owner directive: eliminate repetitive infrastructure-denial and verification deadlocks without weakening user privacy, funds protection, or real provider authority.

## What the current source actually demonstrates
- On main at inspection, `apps/web/ci/verify-route-readiness.mjs` exits nonzero **before building even a preview** if any tracked route is `not_verified` or lacks source/behavior/role-appropriate backend evidence. The manifest has 92 routes: 82 not_verified, 10 source_ready. This is a site-wide release gate applied prematurely to the development/test lifecycle, not evidence that 82 route implementations are broken.
- `apps/web/ci/smoke-routes-local.mjs` tests all routes at 320, 390, 768 and 1280 widths, but explicitly marks protected routes inconclusive without real authenticated sessions. Never turn that outcome into "passed".
- `apps/web/ci/web-preview.yml` uses GitHub-hosted Actions and cannot be relied on in November 2026; no Actions retries until runner entitlement is restored.
- `docs/architecture/IFUND_BUILD_CONTRACT_2026-11-03.md` already names Supabase as record store and Cloudflare R2 as durable media store. Live 2026-11-19 R2 evidence in issue #203 supersedes the older Supabase Storage private-document narrative. Do not create the obsolete bucket or run the old erasure code.

## Permanent operating model
### 1. Independent, ephemeral agent workspaces
For each iFund development agent, provide the same reproducible, **non-production** workspace from an exact current-main SHA, with Node 24, dependencies, local Vite, test runner/browser, isolated PGlite/Postgres fixtures, mock provider transports and a local R2-compatible object adapter. Real production secrets or user records must not be present. If a workspace lacks a checkout, runner, browser or network, log environment-setup failure as its own operational issue and use a verified alternate executor; do not report product code failure. Workspaces are disposable; tests do not need access to production identity, billing, live objects or deployment permissions.

### 2. Capability tiers and provider ownership
| Tier | Agent authority | Outcome |
| --- | --- | --- |
| A: local implementation | Read source; edit assigned files; build; synthetic DB/object tests; sandbox browser; create scoped commits/PRs | No production permission needed |
| B: remote read-only | Read GitHub PRs and checks, Cloudflare deployment metadata, Supabase schema/config inventory through available authorized connectors | No private user data, no provider mutation |
| C: isolated preview | Upload **one** scoped, non-live preview artifact with preview credentials and test accounts after build/source checks | No production DNS, payment, email send, external publish, or destructive operations |
| D: production | Exact SHA promotion, schema change, secret rotation or feature flag, under an approved release workflow and independently executed role/security/financial gates | Short-lived scoped credentials; rollback and audit |
| E: financial/external effects | Live charge/refund/payout, real email/social post, third-party credential grants, destructive data operations | Explicit operation-specific authorization, verified providers, owner-scoped checks and immutable receipts |

iFund can grant role-specific access **within its own code** but cannot bypass GitHub, Cloudflare, Supabase, PayPal, Apple, Meta or other providers' IAM/OAuth/consent boundaries. Repository ownership and agent task ownership are **not** service credentials. An API key or service-role token must never be propagated to general agent language-model context or to a client bundle. Do not disable RLS to make an agent's test pass.

### 3. Make the acceptance gate useful rather than circular
Keep `verify-route-readiness.mjs` as the **full release** gate. Introduce a distinct development preflight that verifies JSON manifest integrity, nonplaceholder routes, syntax/build and targeted regressions WITHOUT requiring all other historical routes to be accepted. The command must have an unmistakable name, output `DEV ONLY — NOT RELEASE CERTIFIED`, and be impossible to substitute for production promotion. Run preview browser cases independently after safe local build, and then require the full 92-route role-aware release gate, SQL/RLS negative cases, financial and privacy gates, user/admin browser acceptance and deployment provenance before production. Do **not** silently change the existing release gate to always pass or mark unknown routes as ready. If current preview policy forbids any build, allow isolated **local** Vite builds first and seek a bounded QA-only preview exception through the owner-approved release process.

### 4. Replace ambiguous DENIED statuses with typed recoverable outcomes
Every task should return: `code` (MISSING_CHECKOUT | MISSING_RUNTIME | MISSING_SCOPED_CREDENTIAL | PROVIDER_NOT_AUTHORIZED | AUTHZ_DENIED | SCHEMA_DRIFT | UNVERIFIED_ROLE | COST_LIMIT | PRODUCT_REGRESSION), `capability`, `environment`, `source_sha`, `operation`, `evidence`, `retryable`, `alternate_executor`, `next_owner`. Automatically reattempt only safe, idempotent work after a bounded delay and refresh health checks. Do not retry a genuine 403/401, invalid consent, live charge, webhook, or non-idempotent database mutation in a loop. A provider authentication denial does not imply a source code defect. Continue independent work rather than repeatedly posting the same unresolved blocker.

### 5. Prevention and ownership
- Agent 1: frontend, local browser fixture roles at 320/390px, safe explicit errors and clear user UX.
- Agent 2: versioned DB/RLS and R2 contracts; local synthetic fixture migrations, owner and cross-owner tests; same-origin Workers; separate preview/production credentials.
- Agent 3: mock provider + real sandbox test harness, OAuth authorization registry, expiry/refresh/status, signed ledger and replay receipts; never fake provider approval.
- Agent 4: independent execute-first QA in a reproducible runner, full-route release evidence by role, changed-surface impact and security regression report.
- Coordinator: capability/permission matrix, source/deployment SHA reconciliation, blocked-task deduplication, distinct DEV vs PREVIEW vs RELEASE states, no cross-domain file clashes, verification-based issue #203 handoffs.

### 6. Measurable criteria
A recurring infrastructure denial must produce ONE durable incident with exact error + owner + attempted non-live recovery. Subsequent runs update only changes, not identical commentary. Independently runnable agents keep working in other capability tiers. Product release remains blocked only by specific unverified/failed **release-critical** cases, not by inability to run the preliminary test suite. No route or financial gate is removed, no unverified backend action is declared live, and no payment, user-data erasure, production activation, or Base44 changes are implied by this policy.

## Implementation sequence
1. Agent 4 and coordinator: add an executable local *development-only* preflight alongside, not replacing, the existing fail-closed release checker. Prove the two commands have distinct exit semantics with positive and negative fixtures.
2. Agent 2: ship deterministic synthetic DB/R2 integration fixtures, migration inventory and explicit capability health checks. Preserve production RLS.
3. Agents 1/4: run guest, member, owner, other-owner, admin role browser flows against isolated fixtures; collect actual screenshots and persisted results.
4. Agent 3: provider sandbox record/replay and credentials/consent inventory, with hard gates for live financial and external effects.
5. Coordinator: assess one clean, smallest-scope preview after preflight and original security gates; independently promote only after full release acceptance. Never rely on GitHub-hosted runner minutes during November 2026.

Evidence basis: GitHub issue #203 latest 2026-11-19 coordinator and agent reports; exact inspected main files `apps/web/ci/verify-route-readiness.mjs` SHA 537dc1bbdf1048deef95714d59642218d2f3a70c, `apps/web/ci/smoke-routes-local.mjs` SHA b938d9926dcfe180ddc105e4affa4d55d3bc21f6, route manifest SHA 28af92cc553dddfbf75c0e2e7cab45b2b90b16cd. It does not assert local Node/browser/PG tests executed.
