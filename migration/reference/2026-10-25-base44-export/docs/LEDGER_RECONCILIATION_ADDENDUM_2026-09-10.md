# Ledger Reconciliation Addendum

Effective: 2026-09-10

This addendum is part of the canonical capability ledger for `interplanetary-fund2` and must be read with `docs/FULL_FEATURE_MIGRATION_LEDGER.md` and `docs/IF_FEATURE_RECONCILIATION_2026-08-21.md`.

## Authority and scope

- `interplanetary-fund2` is the authoritative Base44 application and current product destination.
- Existing Convex/Vercel product capability evidence must be recovered where safe, but infrastructure migration is deferred.
- The deferred-infrastructure rule does not waive the urgent Production Convex reconciliation and Development-first concurrency repair before any future Production promotion.
- Do not classify a capability as complete from source presence alone; exact runtime, authorization, privacy, payment, responsive/mobile, accessibility, and build evidence remain required.

## Runtime release gate

Node 20 is the Base44/default build baseline and Node 22 remains supported. Release evidence must reconcile `package.json`, `package-lock.json`, `.node-version`, `.nvmrc`, CI workflows, and the exact PR head. CI must retain Node 20 coverage; a Node-22-only gate is a regression. Node 24 remains unsupported.

## Inventory status corrections

The following classifications are intentionally conservative until current-main source evidence and safe contracts are verified:

| Capability | Classification | Required evidence before implementation/approval |
|---|---|---|
| Donors directory | `MISSING_SAFE_TO_IMPLEMENT` | current route/component evidence, donor privacy policy, owner/admin authorization contract, data-minimization rules, and focused runtime tests |
| Campaign comparison | `BLOCKED` | explicit product decision that comparison remains approved, field-level data-minimization contract, authorization/privacy review, and acceptance criteria |
| Responsive/mobile layout | `MISSING_SAFE_TO_IMPLEMENT` | page inventory, narrow viewport/WebView checks, touch scrolling, overflow fixes, and accessibility evidence |
| Logo/branding propagation | `MISSING_SAFE_TO_IMPLEMENT` | exact asset inventory and approved branding source, followed by cross-surface verification |
| Integration analysis truth | `MISSING_SAFE_TO_IMPLEMENT` | verified current Base44/GitHub connection state and removal of stale/deferred-infrastructure claims |

## Financial authority

- Canonical settlement/ledger truth controls payment status, available balance, withdrawal eligibility, and historical migration baselines.
- The approved withdrawal fee is 3%; historical 7% references remain unresolved until reconciled by a reviewed decision.
- Legacy baseline/read paths must exclude canonical-operation rows and use the same explicit settlement/payment confirmation predicate as production financial code.
- No UI may infer payment success, balance, provider readiness, or deployment state from client-visible shape alone.
- IF #0.5 remains blocked until the authoritative fee and ledger contract is explicitly reconciled.

## Publication truth

A non-null GitHub `merge_commit_sha` on an open or Draft PR is metadata only. Publication requires verified actual PR state, base, head SHA, approvals, CI status, and merge result. Agent 1 must not treat stale review text or metadata as completion evidence.

## Next safe sequence

1. Re-run current-main inventory/classification against this addendum and the 2026-08-21 reconciliation baseline.
2. Complete the queued focused PR reviews in order without parallel duplicate implementations.
3. Preserve the Convex source-of-truth boundary; do not modify deployed Convex behavior until the authoritative deployed topology is reconciled.
4. For any runtime change, attach exact-head Node 20 Base44-baseline evidence, Node 22 compatibility evidence where applicable, and focused behavior evidence before Agent 2+3 review and Agent 3 final verification.
