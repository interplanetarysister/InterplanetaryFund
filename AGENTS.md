# Interplanetary Fund — mandatory builder instructions
Read [the canonical architecture and execution contract](docs/architecture/IFUND_BUILD_CONTRACT_2026-11-03.md) before changing code, SQL, Cloudflare, Supabase, or deployment settings. Track work against [issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137) and the 59-route/184-entrypoint parity inventories.

## Active platform: one system
- **Implementation repository:** `interplanetarysister/InterplanetaryFund`; **canonical frontend:** `apps/web`; **platform:** Cloudflare Pages + Workers + R2 (single media object store), Supabase Postgres/Auth (sole durable application data store), GitHub, authorized external integrations.
- **Read-only reference:** `interplanetary-fund2` / original Base44 APK. Historical root frontend remains only until replacement parity is tested. Do not deploy code from the reference repo, maintain a parallel production frontend, use `interplanetary-fund-backend`, or restore Convex/Vercel.
- The user wants the full Base44 exit and APK-equivalent experience. Never call the platform completed just because a build or CI passes. Use preview first; no production payment activation, DNS/mail cutover, or Base44 retirement without final approval.
- Preserve existing work; inspect current GitHub files and actual hosted Supabase/Cloudflare state before changing them. Repo documents may be stale. Never guess a URL, account mapping, existing schema, migration state, webhook secret or feature completion.

## Build discipline
- **Mandatory one-store Base44 data parity:** Before and after every change, follow [the data and media preservation contract](docs/migration/BASE44_PARITY_STORAGE_CONTRACT.md). Supabase Postgres is the sole durable record system; Cloudflare R2 is the sole durable media store. Never duplicate asset bytes in Supabase Storage or duplicate application records in KV/D1. KV is ephemeral cache only. Reconcile source IDs, ownership, counts, media checksums, and excluded secrets. Source snapshots are migration evidence only, not live cutover or provider-verified funds. Inspect the six reported existing PayPal webhooks before any new registration.
1. Read the architecture contract, relevant source, deployed configuration, migration history, and `docs/migration/{STATUS,INVENTORY,BLOCKERS}.md` before planning or editing.
2. Define one demonstrable user behavior or backend contract. Assign canonical file ownership, avoid duplicate route/function/grant implementations, and identify dependent services.
3. Implement a reviewable scoped change, with database changes additive and reconciled against existing production catalog. Never apply all `pending/` migrations blindly.
4. Test success and negative cases (unauthenticated, other owner, suspended account, stale state, duplicate webhook, invalid input). Prove browser + live provider/database behavior when claiming runtime functionality.
5. Record commit/PR, tests actually run, live state, blockers and next steps. Builder 1 implements, Reviewer 2 independently checks, Auditor 3 verifies end-to-end parity. Agent evidence never substitutes for direct verification.

## Security and consent rules
- Supabase RLS, column grants and ownership claims are authoritative; client-side checks are visual only. Do not infer admin/owner identity from email matching or unverified legacy IDs.
- Never commit secrets or leak service-role keys to `VITE_*` variables. Cloudflare Worker secrets belong in runtime secret bindings. Separate preview and production side effects.
- Provider payments must be verified, logged and idempotent; the 7% fee is deducted at withdrawal, and payout data/actions are owner-only. Never simulate donation success or activate withdrawals without approved provider testing.
- Marketing/social destinations follow user consent (auto/ask/draft/manual) and explicit provider authorization. Follow provider rate limits.
- No paid services without approval. Preserve existing email routing, rollback, source data and legacy platform until end-to-end acceptance.

## Completion standard
A feature is complete only when its source, API, SQL/RLS, auth, frontend state, error states, responsive mobile behavior and preview/live checks are reconciled and documented. `NOT TESTED` is not `PASS`. Never merge overlapping grant migrations without a single reconciled policy owner.

## Release freeze — owner-controlled, build-on-command (2026-11-12)

**Authoritative: code changes accumulate; builds and deployments happen only after the owner explicitly says to build or release.** This overrides earlier instructions that encouraged builders, scheduled agents, or CI tasks to deploy after each successful feature.

- Cloudflare Pages project `interplanetaryfund-migration` has Git-connected production **and** preview auto-deploy disabled. Do not re-enable either trigger, change project source, or call `POST /deployments` while preparing features, running reviews, merging, or fixing bugs.
- All builders/agents commit reviewed implementation, migrations, and tests to the canonical `InterplanetaryFund` repository. Record tests runnable locally, negative cases, security checks, dependency readiness and a release manifest **without** uploading a Pages artifact on each commit. Never claim a queued build is published.
- Use the single manual `.github/workflows/deploy-web-pages.yml` workflow as the controlled release route. The owner saying **build** authorizes one consolidated immutable commit to be tested and published to **preview**. Production promotion requires the owner's explicit **production / go live** instruction. Never infer production approval from a generic code-completion request.
- One build of `apps/web` per authorized release. Run tests and compile **once**; upload that exact `dist` artifact to preview and, only if approved and preview checks pass, production. Avoid parallel manual Pages deployments, duplicate branch deployments, or separate per-agent releases. Stop on build failure, keep the previous healthy production deployment and its rollback reference.
- Cloudflare Workers, Supabase Edge Functions, SQL migrations, R2 operations, and Base44 are **not** implicitly deployed by a Pages publish. Include their exact versions, separate approval/validation, and runtime dependencies in the release manifest. In particular do not silently execute financial/provider writes.
- Preserve ALL Git history, SQL rows, Supabase projects, R2 objects, existing successful production/preview deployments, and the original Base44 reference. Never delete completed deployments as a queue-cleanup shortcut. Pending duplicate Pages jobs may be removed only after verifying they never built, without touching successful releases.
- No agent or scheduled automation may issue a production or preview deployment unless the owner specifically requested a build in the active task. Scheduled auditing, code review and preparations remain allowed; do not interpret prior standing 'deploy live' language as ongoing release permission.


## CURRENT OWNER HOLD — Connections and full-site verification (2026-11-12, Pacific)
The newest owner instruction is **do not deploy anything to production until Connections parity, remaining issues, and full-site regression are repaired and verified**. This supersedes any older standing deploy permission in automated prompts. Continue source edits, isolated tests and safe preview validation, but DO NOT issue Cloudflare production Pages/Workers deployments, enable payment/payout writes, cut over DNS, or apply live provider config until the release gate is satisfied.

**Observed Cloudflare gotcha:** setting deprecated `source.config.deployments_enabled=true` to initiate a branch-only preview ALSO queued unrelated `main` production Git deployments even while `production_deployments_enabled=false`. Keep **all three** settings at `deployments_enabled=false`, `production_deployments_enabled=false`, and `preview_deployment_setting=none`. Use the manually dispatched preview-only pipeline instead; do not toggle Git source deployment triggers on and off.

The owner is requesting working connections, not a visual imitation. Base44 reference has 46 destinations, plus Google's iFund identity tile. The reviewed independent preview is at `https://feature-connections-icon-hub.interplanetaryfund-migration.pages.dev/connections`; add-on link storage migration `20261113080000_ifund_member_connections_hub.sql` is **SOURCE ONLY**, not applied to production. 415/415 web and 3/3 PGlite tests passed, but these do **not** prove real provider authorizations. Current `interplanetary-fund-api-migration` Worker lacks necessary runtime storage/provider bindings, and no member OAuth provider grant was verified. Do not label saved public URLs as securely connected.

A conditional request for production AFTER full QA does not authorize early promotion. Preserve existing successful production deployments. Only delete confirmed idle/queued accidental jobs, never successful releases. Record any remaining blocked tests and missing credentials in the release manifest.
