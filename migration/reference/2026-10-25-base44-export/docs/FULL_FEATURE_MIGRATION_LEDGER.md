# Canonical Platform Capability & Migration Ledger

Effective: 2026-09-09

`interplanetary-fund2` is the authoritative Base44-hosted application and the current destination for the complete Interplanetary Fund platform. This ledger is the shared source of truth for recovery, implementation, review, and verification across all historical iterations.

## Current architecture rule

Complete the whole platform in Base44 first. Vercel and Convex are **deferred infrastructure**, not abandoned product capability. This Base44-first product phase does **not** waive the urgent reliability obligation for the already-reported Production Convex write-conflict incident. Before any future Production promotion or infrastructure change:

1. reconcile the actual deployed Convex automation/backend with the canonical source;
2. reproduce and validate the fix in Development first;
3. repair shared-write contention with serialization/claiming, idempotency, duplicate-run prevention, and bounded retry semantics; and
4. complete the full Agent 1 → Agent 2+3 → Agent 1 → Agent 3 workflow with explicit evidence.

Do not spend current effort implementing, deploying, repairing, or migrating Vercel/Convex runtime infrastructure as part of ordinary Base44 feature work. When historical Vercel/Convex code supplied a useful page, workflow, automation, integration behavior, data contract, or user/admin capability, recover the intended capability and implement a safe Base44-compatible equivalent where possible. Preserve documented contracts and provenance needed for a later Vercel/Convex phase.

Current runtime decision: **Node 22 is canonical for the Base44 application and all release gates.** This decision applies consistently to `package.json` engines, `package-lock.json`, `.node-version`, `.nvmrc`, CI workflows, local verification, and active PRs unless a PR explicitly documents a temporary compatibility matrix. A PR that still requests Node 24 verification must be reconciled to the Node 22 decision before approval; Node 24 evidence is not a substitute for Node 22 evidence.

## Evidence rules

- Never infer live provider state, credentials, ownership, payment status, deployment state, or completion.
- Source-code presence is evidence of an implementation attempt, not runtime proof.
- Compare every candidate against exact current `interplanetary-fund2` main before changing code.
- Prefer the newer secure implementation when historical behavior conflicts with current authorization, privacy, payment-integrity, accessibility, or data-integrity requirements.
- Do not blindly copy deployment/runtime dependencies from historical repositories.
- Preserve useful behavior; do not recreate duplicates.
- Prefer zero-cost/non-metered inspection and validation paths. Do not silently consume protected credits or paid services.

## Classification vocabulary

Every discovered capability must end in one of these states:

- `PRESENT_VERIFIED` — implemented in fund2 and equivalence/runtime evidence is sufficient.
- `PRESENT_NEEDS_VERIFICATION` — implementation exists but equivalence/runtime behavior is not yet proven.
- `MISSING_SAFE_TO_IMPLEMENT` — verified requirement/capability is absent and has a safe Base44 path.
- `IN_PROGRESS` — active implementation/reconciliation exists.
- `SUPERSEDED` — intentionally replaced by a newer verified implementation.
- `DEFERRED_INFRASTRUCTURE` — Vercel/Convex infrastructure itself; retain evidence for later phase.
- `UNSAFE_REJECTED` — historical behavior must not be restored because it violates current security/integrity requirements.
- `BLOCKED` — requirement is verified but a specific dependency/decision prevents safe implementation.

No capability may disappear merely because its original implementation lived in Vercel, Convex, a legacy backend, or an obsolete repository.

## Source repositories

| Source | Current role | Recovery rule |
|---|---|---|
| `interplanetary-fund2` | authoritative Base44 application | destination and current truth |
| `InterplanetaryFund` | historical Convex/application evidence | recover product capability; defer Convex runtime |
| `interplanetaryfund1` | prior full implementation/reference | reconcile verified deltas |
| `interplanetary-fund` | prior application/reference | reconcile verified deltas |
| `interplanetaryfund-base44` | prior Base44/reference | reconcile verified deltas |
| `interplanetary-fund-backend` | legacy/backend evidence | recover required behavior/contracts without blindly duplicating runtime |
| `Admin-software` | admin/reference | recover applicable Interplanetary Fund admin UX/capabilities |
| `convex-vercel-git-44` | infrastructure/application evidence | recover useful capability; defer infrastructure |
| `codex44-agent` | private workflow/tooling | recover safe process knowledge only; never copy secrets/private material into public app |

## Canonical capability inventory

| Capability / surface | Historical evidence | Current fund2 evidence/status | Classification | Next safe action |
|---|---|---|---|---|
| Payment provider truth/status | PayPal/Stripe implementations and runtime reports | capability/onboarding work exists; inconsistent frontend analysis/status has been observed | `IN_PROGRESS` | unify every campaign, AI, connections, and admin status surface on verified provider capability; never infer availability |
| Connected financial accounts | `interplanetaryfund1/src/pages/FinancialManagement.tsx` | connection/admin entities/components exist; equivalence unproven | `PRESENT_NEEDS_VERIFICATION` | reconcile connect/revoke/campaign authorization UX |
| Count My Money / consolidation / migrate funds | prior FinancialManagement plus fund2 sync engine | `CountMyMoney`, `AccountManagement`, `Connections`, `FundMigrationDashboard`, request-triggered `syncExternalFunds`; no scheduled external sync | `PRESENT_NEEDS_VERIFICATION` | verify reconciliation detail, ownership boundaries, explicit request dedupe/rate limiting, and preserved payment webhooks |
| Financial ledger | prior FinancialManagement | protected `/ledger` now reads a server-authoritative owner-scoped view of canonical `FinancialOperation` and `HoldingLedgerEntry` records; provider transaction/payout references are not exposed to the client | `PRESENT_VERIFIED` | preserve `scripts/verify-owner-financial-ledger.mjs`; runtime-check owner isolation after publish |
| AI financial automation | prior FinancialManagement | agents exist; per-campaign equivalence unproven | `PRESENT_NEEDS_VERIFICATION` | recover per-campaign controls and Base44-native execution behavior |
| Withdrawal management | prior FinancialManagement + fund2 secure withdrawal work | owner withdrawal UI uses server-authoritative settled balance summaries; canonical reservation/payout/reconciliation, 3% fee, settlement holds, external settled custody, admin review, and safe reservation release are covered by direct financial-integrity contracts | `PRESENT_VERIFIED` | preserve `test-financial-integrity.mjs`, `verify-settled-external-withdrawal.mjs`, and PayPal payout contracts; runtime provider payout remains external evidence |
| Financial audit log | prior financial UI + fund2 `AuditLog` | admin-only `/admin/audit` view now exposes sanitized operational/financial history without rendering metadata; shared audit helper recursively redacts secret-like metadata keys before persistence and sanitizes logging failures | `PRESENT_VERIFIED` | preserve `scripts/verify-audit-log-contract.mjs`; owner-facing financial history remains the withdrawal/giving/supporter surfaces rather than raw admin audit events |
| Notifications | `interplanetaryfund1/src/pages/Notifications.tsx` | authenticated owner-scoped notification list, mark-read/all-read, navigation links, pull-to-refresh, stale-request guards, malformed-response handling and accessible retry/error states are implemented | `PRESENT_VERIFIED` | preserve `scripts/verify-notifications-comparison.mjs`; runtime-check owner isolation after publish |
| Donors directory | `interplanetaryfund1/src/pages/Donors.tsx` | restored as protected `/donors` Supporters view backed by an owner-scoped server function; only provider-verified gifts are included, anonymous gifts remain anonymous, raw donor account identifiers/contact details are not returned | `PRESENT_VERIFIED` | preserve `scripts/verify-donor-directory.mjs`; runtime-check campaign-owner isolation after publish |
| Campaign comparison | `interplanetaryfund1/src/pages/Compare.tsx` | Discover includes an informational up-to-three campaign comparison with responsive horizontal table containment and explicit user selection | `PRESENT_VERIFIED` | preserve `scripts/verify-notifications-comparison.mjs`; comparison remains informational and does not rank/determine support |
| Platform dashboard | historical `PlatformDashboard` references | connections/admin UX exists; equivalence unproven | `PRESENT_NEEDS_VERIFICATION` | recover useful platform-management behavior |
| AI campaign wizard | historical `AICampaignWizard` references | current AI campaign flow exists; equivalence unproven | `PRESENT_NEEDS_VERIFICATION` | compare and recover missing steps without duplicating newer flow |
| Responsive/mobile layout | current published app observation | platform-wide single-touch pan-y rules, responsive globe sizing, bounded dialogs/sheets, mobile safe-area navigation, and overflow-safe table wrappers are implemented; direct Base44 mobile-layout contract + TypeScript/ESLint/build pass on the post-repair branch | `PRESENT_VERIFIED` | keep regression contract in `scripts/verify-mobile-layout-contract.mjs`; re-test representative real devices after publish |
| Logo/branding propagation | approved one-ring blue/purple planet branding + current published observation | canonical local `/interplanetary-planet.svg` now drives `BrandLogo` including app loading/auth/navigation/marketing; manifest/favicon assets remain present and build-verified | `PRESENT_VERIFIED` | keep regression contract in `scripts/verify-brand-propagation.mjs`; visually confirm installed-app icons after next publish/install |
| Integration analysis truth | current platform analysis + actual Base44/GitHub connection | registry/status UI now fail closed, unknown does not become Active, provider capability cannot be manufactured by stored rows, and active Convex runtime remains explicitly absent | `PRESENT_VERIFIED` | preserve `verify-integration-registry-truth.mjs` and `verify-no-active-convex-runtime.mjs` as release contracts |
| Convex-derived capabilities | historical Convex implementation | runtime is deferred, but Production write-conflict incident remains a required reliability work item before promotion | `DEFERRED_INFRASTRUCTURE` for runtime; `BLOCKED` for promotion | reconcile deployed topology, reproduce in Development, repair serialization/idempotency, then complete full review workflow |
| Vercel-derived capabilities | historical Vercel implementation | runtime is deferred | `DEFERRED_INFRASTRUCTURE` for runtime only | inventory each product capability separately and provide Base44 equivalent where safe; retain future Vercel contracts |

## Financial source-of-truth and fee contract

- Canonical settlement/ledger truth is authoritative for payment status, available balance, withdrawal eligibility, and historical migration baselines.
- The approved withdrawal fee is **3%** unless a newer signed product decision explicitly supersedes it; historical 7% references are treated as stale/unresolved until reconciled.
- Legacy baseline/read paths must exclude rows with a canonical operation identifier and must use the same explicit payment/settlement confirmation predicate as the production financial code.
- No ledger, withdrawal, or analytics surface may infer payment success, available balance, or provider readiness from client-visible shape alone.
- IF #0.5 fee/source-of-truth decisions remain `BLOCKED` until the authoritative settlement/ledger contract and any conflicting historical references are explicitly reconciled in a reviewed change.

## Specialized agent stages

The active Agent Team uses this order:

1. **Completeness** — inventory all historical pages/features/workflows/automations/integrations and compare with exact fund2 main.
2. **Legacy recovery** — identify intended capability and provenance; separate product behavior from old infrastructure.
3. **Agent 1 implementation** — implement the smallest complete safe Base44-compatible delta on the Node 20 Base44 baseline, retaining Node 22 compatibility.
4. **Agent 2 review** — review exact head for architecture, security, authorization, privacy, payments, accessibility, dependencies, and regressions.
5. **Agent 1 repair** — correct every verified review finding and rerun available checks.
6. **Agent 3 verification** — independently verify exact-head behavior, including negative authorization, responsive/mobile, accessibility, error states, and data/payment integrity where applicable.
7. **Truth/build health** — detect placeholders, simulated/live-state assumptions, dependency/build/publish failures, navigation/scrolling/branding regressions, and stale integration analysis.
8. **Knowledge retention** — record verified reusable lessons, provenance, contracts, tests, and future-infrastructure notes in repository-owned documentation.

Paused specialist workflows should be activated only when independent recurring attention is useful; they are not substitutes for this primary sequence.

## Capability record requirements

For every inventory item, record all of the following before classifying it as complete:

- capability/page/workflow name;
- source repository, path, issue, PR, and commit when available;
- user/admin role and expected behavior;
- current fund2 evidence;
- classification;
- security, privacy, and payment implications;
- whether historical Vercel/Convex infrastructure was involved;
- Base44-compatible replacement strategy;
- exact verification evidence and remaining gap; and
- future Vercel/Convex contract/interface notes when relevant.

A row that lacks these fields is a **partial baseline**, not completion evidence.

## Base44 completeness gate

The Base44 phase is complete only when:

1. Every accessible historical Interplanetary Fund source has been inventoried at feature/page/workflow/automation/integration level.
2. Every verified capability is classified using this ledger; there are no silent omissions.
3. Every `MISSING_SAFE_TO_IMPLEMENT` item is implemented and independently verified, or moved to another classification with evidence.
4. Vercel/Convex **product capabilities** required by the platform have safe Base44 equivalents where feasible; only infrastructure-specific work remains deferred.
5. Public/user/admin authorization boundaries, withdrawal/payment rules, privacy, and data integrity are independently verified.
6. No UI invents connected/live/configured/deployed/payment state without evidence.
7. Node 20 Base44-baseline build/dependency checks pass, Node 22 compatibility checks pass where available, and Base44 publishing remains healthy.
8. Responsive/mobile behavior, navigation, scrolling, accessibility, error states, and approved branding are verified across the complete page inventory.
9. No source repository is archived/deleted solely because migration appears complete; equivalence and dependency removal must be proven first.
10. Future Convex/Vercel reimplementation has preserved capability provenance and interface/contract notes sufficient to begin a later infrastructure phase without rediscovering platform requirements.

## Publication metadata rule

GitHub `merge_commit_sha` is not publication evidence. A PR is considered unpublished until its actual state, base, head SHA, review approvals, CI status, and merge result are independently verified. Any non-null merge metadata on an open or Draft PR must be recorded as a metadata anomaly and must not be treated as completion, approval, or deployment.

