# Interplanetary Fund — mandatory builder instructions
Read [the canonical architecture and execution contract](docs/architecture/IFUND_BUILD_CONTRACT_2026-11-03.md) before changing code, SQL, Cloudflare, Supabase, or deployment settings. Track work against [issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137) and the 59-route/184-entrypoint parity inventories.

## Zero Base44 credits — owner directive 2026-11-08

Applies to every development, review, audit and application agent. Do not initiate Base44 builder turns, native agent inference/conversations, metered workflows, Core integrations, deployment, hosting/API operations or other actions that consume Base44 credits. Unknown billing is blocked, not permission to probe. Do not buy credits, upgrade plans, bypass quotas or transfer work to a paid provider. Repository edits and deterministic local checks are the default development path.

For application agents, prompt instructions alone cannot make native Base44 inference free. Preserve the reference implementation; prepare a verified independent execution adapter and reconcile every tool, auth, storage, scheduled job and callback dependency before claiming zero-credit operation. Do not silently disable features or claim that switching the model migrates its tools. Report unavailable capabilities explicitly. Do not run live Base44 agent tests while credit use is unresolved.

The requested sequence is: verify all agents on the Base44 version without Base44 credits, then complete the remaining-agent audit for interplanetaryfund.com. Local inventory and preparation may continue while live verification is blocked. Record source-only evidence separately from live acceptance; never mark the first gate passed from static checks. This directive does not authorize production cutover, payment activation, Base44 retirement or a paid plan.

## Active platform: one system
- **Implementation repository:** `interplanetarysister/InterplanetaryFund`; **canonical frontend:** `apps/web`; **platform:** Cloudflare Pages + Workers, Supabase Postgres/Auth/Storage, GitHub, authorized external integrations.
- **Read-only reference:** `interplanetary-fund2` / original Base44 APK. Historical root frontend remains only until replacement parity is tested. Do not deploy code from the reference repo, maintain a parallel production frontend, use `interplanetary-fund-backend`, or restore Convex/Vercel.
- The user wants the full Base44 exit and APK-equivalent experience. Never call the platform completed just because a build or CI passes. Use preview first; no production payment activation, DNS/mail cutover, or Base44 retirement without final approval.
- Preserve existing work; inspect current GitHub files and actual hosted Supabase/Cloudflare state before changing them. Repo documents may be stale. Never guess a URL, account mapping, existing schema, migration state, webhook secret or feature completion.

## Build discipline
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
