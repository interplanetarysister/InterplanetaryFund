# Convex Automation Concurrency — Development Validation

## Purpose

This runbook is the release gate for the serialized automation repair in PR #12. It must be executed against the intended **Development** Convex deployment before Production promotion. Source-level verification and CI are necessary but are not runtime proof.

## Safety boundary

- Do not use Production credentials in this validation.
- Do not copy bridge secrets or tokens into GitHub comments, logs, screenshots, or committed files.
- Confirm the Development deployment is the target before invoking the lane.
- Reconcile the deployed cron set with `convex/crons.ts` from the exact PR head.

## Required checks

1. Confirm the Development cron set contains exactly one `serialized-automation-lane` schedule for the shared automation lane.
2. Confirm the retired independent schedules are absent: site health, auto-repair, daily post generation, outreach strategy, Browserbase research, Atlas, Post Production, Donor Relations, Scout, Coordinator, and master automation check.
3. Execute at least two serialized-lane cycles under normal Development conditions.
4. Where the deployment supports controlled concurrent invocation, trigger the same lane twice and verify Convex cron ownership prevents overlapping execution. Do not create a second production cron merely for testing.
5. Inspect Development logs for the reported `cron_commit_mut...` conflict/retry class and confirm zero new instances attributable to the serialized lane during the validation window.
6. Correlate the coordinator `runId` with child execution records and confirm child work is awaited sequentially.
7. Verify `distributedPosts` writes from Post Production and Browserbase research do not overlap during the same lane run.
8. Verify a failed child is recorded as failed without launching a parallel copy of that child. The next child may proceed only after the failed child has settled.
9. Verify historical cadence behavior remains intact: site health hourly; post generation at 15:00 UTC; six-hour slot tasks at six-hour boundaries; Atlas 4h; Post Production 6h; Donor Relations 6h; Scout 8h; Coordinator 4h.

## Evidence to record

Record only non-sensitive evidence:

- exact PR commit SHA tested;
- Development deployment identifier/name (not credentials);
- start/end timestamps of the validation window;
- number of serialized-lane cycles observed;
- number of overlapping lane executions observed;
- number of `cron_commit_mut...` conflict/retry events observed;
- confirmation of the deployed cron registration set;
- representative run IDs, if safe to share;
- final pass/fail result.

## Promotion rule

Do not promote the repair to Production unless all checks pass, the exact tested commit is the commit being promoted, the Production cron topology has been reconciled against the canonical source, and the Agent 2+3 audit plus Agent 3 final publication gate are complete.
