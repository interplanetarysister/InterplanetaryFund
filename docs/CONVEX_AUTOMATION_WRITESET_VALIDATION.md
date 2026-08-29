# Convex Automation Write-Set Validation

This document is a release-gate artifact for the serialized automation repair. It does not claim that Development or Production validation has occurred.

## Exact-head rule

Validation is valid only when the deployed Convex source SHA exactly matches the reviewed PR head. Historical CI, telemetry, or deployment evidence from another SHA must be treated as superseded.

## Contested record class

The Production incident identified repeated Convex write conflicts involving `cron_commit_mut...` records. A successful retry is not proof of remediation. The acceptance condition is zero underlying conflict events during the controlled validation window.

## Writers that must be correlated

The Development run must enumerate the actual deployed cron/function topology and correlate every writer below against the contested record class:

- `runAllAgentAutomation`
- `runCoordinatorAutomation`
- `runScoutAutomation`
- `checkSiteHealth`
- `runPostProductionAutomation`
- `daily-protocol-autofix`
- `weekly-training-session`
- `proactive-group-discovery`
- `auto-cover-images`
- `auto-fund-consolidation`
- any other cron/function discovered in the deployed topology that writes the same records

The list above is a starting inventory, not an assertion that the deployed environment matches it.

## Required evidence table

Record one row per observed writer/function:

| Writer | Deployed source SHA | Trigger | Records read | Records written | Overlap with `cron_commit_mut...` | Observed concurrent run | Conflict count |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

Do not fill unknown cells with assumptions. Use `UNKNOWN` and resolve them from Development telemetry/source before approval.

## Serialization checks

1. Confirm only the intended serialized lane owns the shared writer schedule.
2. Confirm child mutations are awaited sequentially.
3. Trigger overlapping/manual invocations where the Development environment permits it.
4. Prove that duplicate triggers cannot produce duplicate shared execution.
5. Exercise a representative child failure and confirm later children remain observable/serialized.
6. Confirm failed work does not advance a false-success cadence marker.
7. Confirm a subsequent scheduled run can retry failed work without duplicating completed side effects.
8. Confirm the remaining independent writers have disjoint write sets from the contested shared records, or move them behind the same authoritative serialization boundary before Production promotion.

## Production reconciliation gate

Before Production promotion, compare the actual deployed Production function and cron topology against the exact Development-validated SHA. If Production contains a function, cron, or writer absent from the visible canonical GitHub source, stop and reconcile the source before changing or deleting the deployed behavior.

## Reporting status vocabulary

Use only these labels:

- **ACCOMPLISHED** — exact-head implementation plus required runtime evidence is complete and independently audited.
- **TRUNCATED / INCOMPLETE** — implementation or validation started but one or more acceptance gates remain.
- **AWAITING START** — planned work with no implementation/validation evidence yet.

Static source inspection alone must never be reported as runtime remediation of the Production conflict incident.
