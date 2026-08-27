# Convex Automation Concurrency — Development Validation

This runbook is the release gate for the serialized automation repair. It must be executed against the exact reviewed commit before any Production promotion.

## Controlled procedure

1. Establish the exact Convex Development deployment and verify it corresponds to the reviewed Git SHA.
2. Deploy the reviewed SHA to Development only; do not modify Production.
3. Inspect the deployed cron registrations and verify the shared writers have one `serialized-automation-lane` scheduler and no independent duplicate schedulers.
4. Run enough real cycles to cover ordinary execution, the 6-hour workers, the 12-hour research worker, and the daily post-generation slot.
5. Correlate coordinator `runId` values with Convex execution telemetry.
6. Verify shared mutations execute sequentially and that no overlapping `distributedPosts` writes or duplicate lane executions occur.
7. Inspect telemetry for the previously observed `cron_commit_mut...` conflict/retry class. A successful retry is not evidence that the underlying contention is fixed; the conflict must be absent for the repaired topology.
8. Exercise a representative child-worker failure and verify later work remains safe, observable, and non-concurrent.
9. Record the exact deployed SHA, cron topology, cycle evidence, conflict observations, and failure-path result on the PR/Issue #10 audit trail.
10. Before promotion, reconcile the intended Production cron/function source against the same reviewed SHA.

## Safety

- Development only until all review gates pass.
- Never expose credentials, secrets, or private deployment identifiers in GitHub.
- Do not increase retries or suppress conflicts as the primary remediation.
- Do not create a self-triggering deployment loop.
- Static CI is necessary but cannot substitute for deployed Development evidence.
