# Interplanetary Fund — target architecture and builder execution contract
Updated 2026-11-03. Authority: owner requirements, the Base44 `interplanetary-fund2` experience, and evidence recorded in this repository. This is a migration specification, **not** a claim that migration or cutover is complete.

## Product and non-negotiable invariants
- One cohesive crowdfunding product at `interplanetaryfund.com`; preserve the original installed-APK workflows, screen behavior and data semantics unless explicitly revised.
- `interplanetarysister/InterplanetaryFund` is the implementation repository. `interplanetary-fund2` is a read-only functional reference, not a production deploy source. Obsolete `interplanetary-fund-backend` and all Vercel/Convex configurations are outside the active architecture.
- One canonical web frontend: `apps/web` (Vite/React). Root `src/` is historical overlap pending verified retirement, not a second production app.
- Cloudflare Pages serves the web bundle; Cloudflare Workers provide the independent API, integrations, webhook intake, AI/agent orchestration and scheduled jobs. Supabase is the canonical Auth, Postgres, RLS and Storage system. GitHub is the sole versioned source of deployable code.
- Use free tiers at initial 1–2-user scale; measure quotas and avoid paid upgrades or new paid resources without explicit owner approval. Design for thousands later without assuming that capacity is already validated.
- Never expose Supabase service/secret keys, payment credentials, webhook verification material or provider refresh tokens in Vite `VITE_*` variables or browser responses. Publishable keys are browser-safe **only when RLS and grants are correct**.
- Financial truth comes only from provider-verified events and an idempotent ledger. The 7% platform fee is taken at withdrawal; only verified owners can request withdrawals and non-owners must never see payout information. Do not fabricate paid/donated/withdrawn states or activate payment paths before real integration tests.
- No DNS/mail cutover, payment enablement or Base44 shutdown without the owner's final approval after the cutover gates pass.

## Request/data architecture

```text
Browser / Android app (existing APK is parity reference)
    -> Cloudflare Pages (apps/web; static assets and SPA fallback)
    -> Supabase publishable client (Auth + owner-scoped RLS reads)
    -> Cloudflare Workers APIs (privileged operations only, user JWT checked)
          -> Supabase Postgres (canonical relational data + RLS)
          -> Supabase Storage (campaign/media assets)
          -> Provider integrations (PayPal, publishing, mail) using scoped secrets
          -> Verified webhook intake -> event deduplication -> ledger/workflow queue
          -> Agent orchestration + consent/approval/audit records
```

No client-to-Base44 runtime dependency in the final product. Keep an explicit migration adapter only until export/import and provider handoff have been reconciled. Do not make Cloudflare D1 a competing source of truth for campaigns, identities, donations or owner mappings; D1 is permitted only for clearly isolated operational state where needed.

## Environment contract
| Environment | Source | Public frontend | Backend | Data |
|---|---|---|---|---|
| Preview | reviewed GitHub branch / PR | isolated Pages preview URL | preview Workers with side effects disabled | staging/isolated test data, or fail-closed reads |
| Production | explicitly approved commit | `interplanetaryfund.com` via Pages | production Workers | Supabase `ssibsfmtodgximseeqsv` |
| Legacy reference | read-only `interplanetary-fund2` | Base44 / existing APK | original backend | original records; preserve until verified cutover |

Required browser build variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Optional `VITE_SUPABASE_OAUTH_PROVIDERS` only names providers already configured in Supabase. Worker secrets are set as scoped runtime secrets, never checked into Git. The production Supabase URL is `https://ssibsfmtodgximseeqsv.supabase.co`.

Cloudflare Pages project `interplanetaryfund-migration` must ultimately point to the `InterplanetaryFund` repository, root `apps/web`, build `npm ci && npm test && npm run build`, output `dist`. Verify and change the live source configuration deliberately; source settings have historically disagreed with actual deployments. Keep automatic production deployment disabled until preview is proven.

## Architecture ownership (one owner per concern)
1. Web UI: `apps/web/src` for all campaign wizard, generated content previews, discovery/search by user city or nearby city (not manually entered coordinates), Earth/Atlas, donation placement, dashboard, following, inbox, editorial, identity and settings flows. Mobile-first safe areas/back navigation/scrolling.
2. API: Cloudflare Workers, with explicit route registration, request validation, identity checks, per-owner authorization, rate limits, structured safe errors, idempotency and audit events. Public-only read endpoints cannot expose private columns.
3. Database: Supabase `public.ifund_*` and restricted operational/private schemas. Canonical ownership based on verified Supabase Auth identities and mapped legacy IDs. Prevent duplicate financial/entity stores; inventory the already-applied migration history before any DDL.
4. Agents/workflows: registered task types, worker execution, consent per destination, retry/backoff, idempotency, audit and explicit capability gates; marketing and social distribution must respect user authorization.
5. Payment subsystem: segregated webhook verification, payments ledger, fee and owner withdrawal modules. Zero state transitions without verified provider response. Disable outward payment effects until signed provider round trips pass.
6. Deploy/operations: versioned GitHub workflows; deterministic Node 22 build; Cloudflare Pages preview-first; Supabase RLS tests; alerts, logs, rollback and secrets inventory.

## Execution gates — builder must complete in order without stopping at a green test
**Gate A: baseline.** Verify current `main`, open PRs, root-vs-`apps/web` overlap, 59-route acceptance matrix, 184 source functions, source schema inventory, live Cloudflare Pages and Worker bindings, Supabase migration history and RLS. Replace stale blocker claims with dated verified facts. Do not assume previously reported counts equal the current state.

**Gate B: database reconciliation.** Make a catalog diff against `ssibsfmtodgximseeqsv`, classify each repo SQL file as applied/equivalent/conflicting/missing; apply only reviewed, additive, order-safe migrations. Verify actual primary keys, grants, policies, constraints, function signatures, browser access and cross-account denial with two real test identities. Keep existing production records and verified owner mappings intact.

**Gate C: auth and owner identity.** Support regular Supabase Auth email/password and configured Google/Facebook OAuth, without requiring users to know what Supabase is. Instagram login only if a supported, validated provider route actually exists. Map legacy owners through verified login/claim, never email-string matching; suspend unverified owners by default.

**Gate D: API/workflow parity.** Track 184 entrypoints as `ported/tested/blocked/retired with evidence`, including AI campaign creation (5 title candidates, 2 summaries, 1 story), agent workflows, notification/inbox sync, publishing consent, embeds, QR, media, campaigns and admin. For each endpoint add positive/negative and idempotency tests. Isolate money workflows until verified.

**Gate E: UI parity.** Test the complete route matrix, not page count alone. Make campaign save/publish/reload/discover, owner settings, following, login, Atlas marker navigation, embed and inbox work against the canonical backend. Use an intergalactic/cyberpunk visual system with extremely simple interaction and phone-safe layout; match original APK behavior where present.

**Gate F: import/reconciliation.** Inventory all batches, preserve legacy IDs and original audit evidence. Reconcile per-table counts/hashes, campaign/owner links, media, provider connections, workflows and verified ledger balances. Never mark mismatched or unverified financial rows as captured donations.

**Gate G: release.** Verify builds/tests/preview URLs, deep links, OAuth redirects, RLS privacy, agent and webhook authentication, fail-closed payment gates, and rollback. Repair Pages source/root mismatch. Only after owner signoff promote the tested `apps/web` artifact, change DNS if needed while preserving mail, and retire Base44 after full parity.

## Builder / reviewer / auditor collaboration
- **Builder (Agent 1):** one scoped change set at a time, implement and run appropriate tests, submit a PR with changed paths, result, security boundaries and blocked follow-ups. Never copy the source implementation blindly or introduce a second canonical implementation.
- **Reviewer (Agent 2):** inspect actual diffs and production shape independently; reject missing owner checks, broad public grants, secret exposure, broken migration ordering, stale frontend clients and fabricated payment states.
- **Auditor (Agent 3):** verify real behavior and compare artifact/route/function/schema ledger; report `PASS`, `FAIL` or `NOT TESTED`, never infer live success from code or CI alone.
- Lead builder reconciles agent outputs into one issue/PR ledger and ensures one actor owns each shared grant/schema surface. Do not merge conflicting PRs just because individual CI runs pass.

## Required evidence after each increment
Record exact repository ref/commit/PR, target account/project, changed files, migrations applied and their versions, CLI/browser tests actually executed, expected-vs-observed behavior, any production mutation, unresolved blockers, and next independently executable action. Never claim `production ready` while a single required route, identity mapping, ledger verification or webhook round trip remains untested.

## Immediate verified baseline, 2026-11-03
- Connected Supabase production `ssibsfmtodgximseeqsv` and legacy `tzehxfikoslihnclhxuz` are distinct projects; do not mix them.
- Production migration history already contains `ifund_base44_entity_storage_66_tables`, `public_campaign_detail_invoker_read` and `ifund_legal_acceptances_additive_schema_reconciliation_20261102`. Re-applying repository `pending/` SQL as if the destination were empty is unsafe.
- Target `apps/web` is selected by `docs/migration/CANONICAL_FRONTEND_AND_DEPLOYMENT_PLAN.md`, but Cloudflare Pages source configuration and live deployment must be independently verified before any promotion.
- Prior 2026-10-24 status and blockers contain historical claims; they are not a substitute for live reads.
