# Cloudflare free cron allocation — 2026-11-26

Verified on the canonical iFund account c95db4f2c901f32776471b85f1eda15d (not the Executive account). All 35 Worker scripts were inventoried before the change. The five account-wide free slots are now:

| Worker | UTC cron | Purpose |
|---|---|---|
| ifund-email-ingress | */5 * * * * | Bounded business-mail archive recovery |
| ifund-workflows | */15 * * * * | Existing workflow manifest plus private agent operations at :00/:30 |
| ifund-hackathon-demo | */30 * * * * | Existing demo payment sweep |
| ifund-training-research | 0,15,30,45 10-12 * * SUN | Existing weekly research |
| onlycryptids-media-scout | */30 * * * * | Unrelated project, unchanged |

Removed only the standalone ifund-agent-ops-autonomy cron after deploying the named AgentOpsScheduler entrypoint and connecting IFUND_AGENT_OPS_SCHEDULER on ifund-workflows. Existing bot credential, database claim/lease, 8/day cap, model, and advisory-only scope were preserved. Direct HTTP fetch on agent Worker still returns 404; its workers.dev subdomain remains disabled. The existing workflow catalog and cron expressions are unchanged, with scheduledTime used for clock matching. Eight isolated dispatch tests passed. Cloudflare API accepted both Worker deployments, confirmed binding preservation, and read back all six affected Workers' schedules after cutover; five total triggers, no paid upgrade.

Source: worker/agents/opsAutonomyScheduler.js and workers/ifund-workflows/index.mjs at branch commit 22e5e28660dcbaca589e021b5c9156dd0abda53f. These sources are recorded on the integration repair branch; not merged to main or published through Pages. No GitHub Actions used.

Remaining evidence: new real cron invocations and durable downstream receipts. The public workflow health endpoint could not be reached by web/container DNS, so live RPC ping was not independently verified. Email receiver network fault is still outstanding; scheduling does not establish successful mail delivery. Existing legacy workflow backend readiness was not certified by this change. Preserve the separate project's cron unless explicitly authorized to change it. Existing weekly training schedule remains UTC, not Pacific-local DST-adjusted.
