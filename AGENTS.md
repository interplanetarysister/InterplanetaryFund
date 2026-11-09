# Interplanetary Fund — mandatory builder instructions
Read [the canonical architecture and execution contract](docs/architecture/IFUND_BUILD_CONTRACT_2026-11-03.md) before changing code, SQL, Cloudflare, Supabase, or deployment settings. Track work against [issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137) and the 59-route/184-entrypoint parity inventories.

## Active platform: one system
- **Implementation repository:** `interplanetarysister/InterplanetaryFund`; **canonical frontend:** `apps/web`; **platform:** Cloudflare Pages + Workers, Supabase Postgres/Auth/Storage, GitHub, authorized external integrations.
- **Read-only reference:** `interplanetary-fund2` / original Base44 APK. Historical root frontend remains only until replacement parity is tested. Do not deploy code from the reference repo, maintain a parallel production frontend, use `interplanetary-fund-backend`, or restore Convex/Vercel.
- The user wants the full Base44 exit and APK-equivalent experience. Never call the platform completed just because a build or CI passes. Use preview first; no production payment activation, DNS/mail cutover, or Base44 retirement without final approval.
- Preserve existing work; inspect current GitHub files and actual hosted Supabase/Cloudflare state before changing them. Repo documents may be stale. Never guess a URL, account mapping, existing schema, migration state, webhook secret or feature completion.

## Build discipline
- **Mandatory Base44 data parity:** Before and after every feature, schema, migration, or deployment change, follow [the cross-cloud source-data and media preservation contract](docs/migration/BASE44_PARITY_STORAGE_CONTRACT.md). Reconcile relevant Base44 entity records into private Supabase snapshots, verified live Supabase models, and appropriate Cloudflare R2/KV storage; record counts, legacy IDs, owner mappings, asset verification, and excluded credentials. No snapshot counts as cutover or provider-verified money.
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
