# Convex Automation Write-Set Validation

This document is a release-gate artifact for the serialized automation repair. It does not claim that Development or Production validation has occurred.

## Exact-head rule

Validation is valid only when the deployed Convex source SHA exactly matches the reviewed PR head. Historical CI, telemetry, or deployment evidence from another SHA is superseded.

## Contested record class

The Production incident identified repeated Convex write conflicts involving `cron_commit_mut...` records. A successful retry is not proof of remediation. The acceptance condition is zero underlying conflict events during controlled validation.

## Starting writer inventory

Development must enumerate the actual deployed cron/function topology and correlate every writer below against the contested record class:

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
- any other discovered writer of the same records

The list is a starting inventory, not a claim that deployed topology matches source.

## Required evidence table

| Writer | Deployed source SHA | Trigger | Records read | Records written | Overlap with `cron_commit_mut...` | Concurrent run observed | Conflict count |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

Unknown values must remain `UNKNOWN` until resolved from Development evidence.

## Serialization checks

1. Confirm only the intended serialized lane owns the shared writer schedule.
2. Confirm child mutations are awaited sequentially.
3. Exercise overlapping/manual triggers where Development permits it.
4. Prove duplicate triggers cannot duplicate shared execution or financial side effects.
5. Exercise a representative child failure and confirm later children remain serialized and observable.
6. Confirm failed work does not advance a false-success marker.
7. Confirm a subsequent cadence can retry failed work without duplicating completed side effects.
8. Confirm independent writers have disjoint write sets from contested records, or move them behind the authoritative serialization boundary before Production.

## Production reconciliation gate

Before Production promotion, compare actual Production function and cron topology against the exact Development-validated SHA. If Production contains a function, cron, or writer absent from visible canonical source, stop and reconcile source before changing deployed behavior.

Static source inspection and successful retries are not runtime remediation evidence.
