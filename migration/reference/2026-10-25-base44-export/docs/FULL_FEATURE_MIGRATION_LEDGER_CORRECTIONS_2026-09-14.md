# Full Feature Migration Ledger — Review Corrections

Effective: 2026-09-19

This addendum is normative for `docs/FULL_FEATURE_MIGRATION_LEDGER.md` until the ledger itself is revised. It records the valid Agent 2 findings and prevents downstream agents from relying on ambiguous or stale claims.

## 1. Runtime ownership boundary

`interplanetarysister/InterplanetaryFund` remains the named authoritative Convex/application backend candidate for existing payment, deduplication, agent-memory, and related bridge behavior. The Base44-first product workflow does **not** authorize replacing or stranding those backend-owned capabilities. Defer only infrastructure-specific migration or repair when direct deployment/runtime evidence is absent.

The Convex incident remains a separate P0 reliability workstream. No implementation may overwrite deployed Convex behavior until Production and Development identity, deployed commit, schema/index state, scheduler ownership, and function mapping are directly reconciled.

## 2. Runtime/version claims

The exact current `main` `package.json` declares Node `22.x`, and the repository's release-gate contract must be derived from the exact current `main` package metadata, lockfile, version files, and active CI workflow. Historical Node 24 claims from older branches or copied documentation are stale unless the coordinated runtime contract is intentionally changed and revalidated across all those sources. Any runtime change requires coordinated updates and exact-head verification.

## 3. Capability classifications corrected

The following capabilities must not be classified `PRESENT_NEEDS_VERIFICATION` solely from historical filenames when no current fund2 page/route evidence exists:

- Donors directory: `MISSING_SAFE_TO_IMPLEMENT` or `BLOCKED` pending privacy/product scope and current route evidence.
- Campaign comparison: `MISSING_SAFE_TO_IMPLEMENT` or `BLOCKED` pending privacy/product scope and current route evidence.

Historical source paths remain provenance evidence only; they do not prove current implementation.

## 4. Normative baseline dependencies

The ledger must be read together with:

- `docs/IF_FEATURE_RECONCILIATION_2026-08-21.md`;
- the Word-document requirements for IF #0.5–#23;
- current exact-main source and route evidence.

Those sources remain normative dependencies for Identity Graph, Communication Hub, Campaign OS, Community/Institution OS, Mission Control, analytics, subscriptions, Help, safety intelligence, and other previously inventoried capability families. A ledger row that omits one of those families is incomplete, not evidence of absence.

## 5. Mutable integration/provider state

Base44/GitHub/Google/OAuth/provider connection, ownership, credential, deployment, payment, and live-status claims are `UNRESOLVED` unless supported by authoritative environment/configuration evidence tied to the relevant account scope and environment. No connection may be inferred from repository names, stale screenshots, historical PR text, or a client-visible status alone.

## 6. Financial policy correction

The current approved Interplanetary Fund platform fee policy is a **7% flat fee on funds raised**, deducted before withdrawal. Any `3%` fee text in the ledger is stale and must not be used as product, financial, or verification truth. Financial source-of-truth claims remain separate: payment status, campaign totals, available balance, withdrawal eligibility, and migration baselines must come from the authoritative settlement/ledger contract rather than client-visible shape alone.

## 7. Completion gate correction

A capability is not complete merely because it has a classification. Completion requires current source evidence, role/authorization and privacy analysis, payment/data-integrity implications where relevant, exact verification evidence, and explicit remaining gaps. Planned, historical, or partially implemented work must remain `IN_PROGRESS`, `BLOCKED`, `DEFERRED_INFRASTRUCTURE`, or `UNRESOLVED` as appropriate.

## 8. Traceability

This addendum is the Agent 1 correction slice for the latest Agent 2 findings on PR #205. It does not claim Node runtime validation, hosted/RLS validation, production deployment, Convex Development repair, merge, or publication.
