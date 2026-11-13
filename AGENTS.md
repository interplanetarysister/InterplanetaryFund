# Interplanetary Fund — mandatory builder instructions

## Owner's non-negotiable platform work order (2026-11-13)

**Priority 1: https://interplanetaryfund.com.** Before changing any other Interplanetary Fund version, inspect whether the corresponding feature, page, repair, integration, payment, or improvement is implemented and actually verified on the canonical Cloudflare Pages + Supabase website. If incomplete, do the canonical implementation first. The bulk of engineering, tests, QA, and release efforts belong there.

**Priority 2: original Interplanetary Fund Base44 app.** Only work there first when the user explicitly requests that specific Base44 version. Likewise, work on the separate sandbox/hackathon demo first only when explicitly requested or the task unmistakably concerns the demo. A Base44-only feature, passing Base44 test, or Base44 deployment never establishes completion on interplanetaryfund.com. Do not copy retired Base44 SDK/financial patterns into the canonical stack.

This work order does not bypass source-route acceptance, preview/production release conditions, payment-provider verification, data-preservation requirements, or user consent. Do not waste deployments; consolidate validated source work into the already-authorized release pipeline.

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

## Explicit release permission — owner directive (2026-11-13, Pacific)

The blanket release freeze is removed. Perform source inspection, implementation, repair and local verification within the owner's requested scope without repeatedly asking permission. Builds and releases are permitted when the owner explicitly authorizes the relevant action; an existing authorization remains valid within its stated scope and conditions.

- A request to build authorizes the requested build. A preview publication requires explicit preview/deployment authorization; do not silently turn a local build request into a publication.
- Production release requires explicit production/go-live authorization. Honor any attached QA or feature-completion conditions before promotion. Do not infer deployment permission from a commit, PR, audit, scheduled task, or a generic request to continue coding.
- Keep Git-connected automatic production and preview deployments disabled. Use the controlled manual release workflow for authorized releases; do not toggle source deployment triggers as a shortcut.
- Prepare one consolidated, reviewable release, test the actual immutable artifact, and reuse it when promoting preview to production. Stop on a failed release gate and preserve the healthy deployment and rollback reference.
- Pages publication does not authorize separate Worker, Edge Function, SQL, R2, Base44 or provider changes. Make required dependencies concrete and reviewable, and execute them only within the owner's authorized scope.
- Actual charges, payout execution, paid infrastructure, DNS/mail changes and destructive operations require their applicable explicit authorization and verification. Never manufacture provider evidence or treat source tests as live acceptance.
- Preserve Git history, SQL records, Supabase projects, R2 objects, successful deployments and the original Base44 reference. Source-only work must not trigger automatic releases.

## Outstanding release validation — Connections and full-site verification

Connections parity and remaining full-site regressions still require verification. This is a quality/evidence checklist, not a blanket freeze. When release authorization is conditional on those checks, satisfy them before promotion; report any remaining blockers accurately. A later explicit owner instruction controls its stated release scope.

**Observed Cloudflare gotcha:** setting deprecated `source.config.deployments_enabled=true` to initiate a branch-only preview ALSO queued unrelated `main` production Git deployments even while `production_deployments_enabled=false`. Keep **all three** settings at `deployments_enabled=false`, `production_deployments_enabled=false`, and `preview_deployment_setting=none`. Use the manually dispatched preview-only pipeline instead; do not toggle Git source deployment triggers on and off.

The owner is requesting working connections, not a visual imitation. Base44 reference has 46 destinations, plus Google's iFund identity tile. The reviewed independent preview is at `https://feature-connections-icon-hub.interplanetaryfund-migration.pages.dev/connections`; add-on link storage migration `20261113080000_ifund_member_connections_hub.sql` is **SOURCE ONLY**, not applied to production. 415/415 web and 3/3 PGlite tests passed, but these do **not** prove real provider authorizations. Current `interplanetary-fund-api-migration` Worker lacks necessary runtime storage/provider bindings, and no member OAuth provider grant was verified. Do not label saved public URLs as securely connected.

A conditional request for production AFTER full QA still requires that QA before promotion. Preserve existing successful production deployments. Only delete confirmed idle/queued accidental jobs, never successful releases. Record any remaining blocked tests and missing credentials in the release manifest.
