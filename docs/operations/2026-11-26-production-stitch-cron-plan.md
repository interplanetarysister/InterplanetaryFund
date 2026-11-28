# Production-only cron allocation and Stitch readiness — 2026-11-26

Owner instruction: remove Hackathon Demo and OnlyCryptids cron triggers; dedicate all five free slots in the canonical iFund account to current production and imminent Stitch features. Preserve the Worker scripts and data; remove schedules only. No paid upgrade.

## Verified deployed allocation (UTC)
| Worker | Cron | Scope |
|---|---|---|
| ifund-email-ingress | */5 * * * * | Existing private business-mail recovery |
| ifund-payments | */10 * * * * | Existing live payout batch reconciliation; no new transfers or automatic resubmission of uncertain payouts |
| ifund-stitch-scheduler | */5 * * * * | Private production health checks plus feature-gated future dispatch |
| ifund-workflows | */15 * * * * | Existing manifest and private agent operations at :00/:30 |
| ifund-training-research | 0,15,30,45 10-12 * * SUN | Existing weekly agent research |

Cloudflare account c95db4f2c901f32776471b85f1eda15d, Pages interplanetaryfund-migration. Account-wide inventory and post-cutover verification confirmed exactly five schedules, neither retired trigger present. All retained schedules unchanged. Supabase pg_cron already has ifund-inapp-reminders-dispatch (five minutes), ifund-nexus-daily-briefs, ifund-training-weekly-start and ifund-training-worker; retain these without duplicate Cloudflare dispatch.

## New Worker
Source and seven passing isolated regression cases: 78115111e7e9667b495315dcb29f96039fa78a2b, workers/ifund-stitch-scheduler/. Cloudflare Worker deployed, cron set, workers.dev and preview URLs disabled. No public action endpoint, no provider credential, no general-purpose database or financial credential. Current private workflow and notification health checks enabled every 30 minutes. Structured run logs enabled. Actual live scheduled invocation receipts not yet verified.

## Future dispatch contract
Registry in index.mjs is executable now. All ten feature flags default disabled. Each consumer must expose a private named service binding with tick({job,scheduledAt,slotKey,batchLimit}), return completed/idle/blocked/retry, and independently enforce a transactional lease/idempotency, current owner consent, quota, eligibility, funding and bounded retries. The scheduler's stable slotKey does not itself guarantee exactly-once processing. Bind and enable only after handler implementation and end-to-end validation. Never add a generic privileged HTTP execution path or reuse an unrelated user's credentials. Use queues/event-driven work for actual media/AI jobs and provider webhooks; cron only handles due jobs, recovery, reconciliation and watchdogs.

| Job | Cadence UTC | Binding |
|---|---|---|
| Approved distribution / Growth Studio calendar | 5m | IFUND_STITCH_DISTRIBUTION |
| Media processing recovery | 5m | IFUND_STITCH_MEDIA |
| Durable integration outbox/retry | 5m | IFUND_STITCH_OUTBOX |
| Paid email and membership reconciliation | 15m, :05/:20/:35/:50 | IFUND_STITCH_ENTITLEMENTS |
| Mission and opportunity deadlines | hourly :10 | IFUND_STITCH_DEADLINES |
| Provider/account sync | hourly :15 | IFUND_STITCH_PROVIDER_SYNC |
| Media/document integrity audit | hourly :20 | IFUND_STITCH_STORAGE_AUDIT |
| Verified opportunities refresh | 6h :30 | IFUND_STITCH_OPPORTUNITIES |
| Growth reports / performance | daily 15:05 UTC | IFUND_STITCH_REPORTS |
| Delivery notifications | 15m :10/:25/:40/:55 | IFUND_STITCH_NOTIFICATIONS |

Each binding has matching _ENABLED flag in Cloudflare, initially disabled. Default publishing is ask-first; no cron may post outside explicit owner approval, current connected-account scope, quiet hours or pause controls. Do not send duplicate in-app reminders; native push/email deliveries use separate receipt keys. Opportunity research must reject expired or stale evidence, no guaranteed eligibility. Storage audit read-only until reviewed erasure workflow is independently authorized. Financial cron must never cause a new charge or transfer; use genuine signed provider events and verified records. Free-tier cadence does not guarantee unlimited AI, media, or third-party quotas.

## Remaining caveats
Existing legacy workflow manifest includes migrated Base44 actions; its actual downstream functions are not certified, no Base44 workflow API key configured. Preserve until exact migration/approval rather than claim all legacy actions work. Paid email billing plan/webhook remains incomplete. Full Stitch/Muse source inaccessible in earlier research (403); registry reflects retrieved project requirements and available research, not a claim that every design screen was reviewed. New consumer implementations, service bindings, real cron receipts and full frontend release validation outstanding. No Pages build or Actions run initiated.
