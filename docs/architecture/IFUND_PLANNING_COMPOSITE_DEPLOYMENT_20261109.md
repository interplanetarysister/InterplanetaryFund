# Unified planning Worker preview — deployment evidence (2026-11-09)

## Actual Cloudflare execution (no existing Worker replaced)
**New deployed Worker:** `ifund-planning-agent-preview`

- Cloudflare deployment: `655e658c-bce2-4814-a33d-1cdc40486b68` (automatic 100% deployment on upload to this **new**, independent script).
- Version: `032d7d4b-5c9e-47ad-9176-2fe3cd3dc343`.
- Read-back SHA-256 of deployed JavaScript: `20d71e807df28759f6373b5f3e68109c16813107d6602c2a7c7c85929abf2c51`; read-back size 22,643 characters.
- Pinned upstream Growth source SHA-256: `29417616be5146de211b8f182978a981a0eae46f0f56a321d75cbb122db9954a` (22,150 characters; upstream deployment `62db8ba1-5d26-4b0d-93ec-78a7af915c13`, version `d225d425-14de-4f13-b850-62f3c013c5a1`). The source-builder now requires this checksum as an input rather than trusting structural markers alone.
- Runtime source: deployed `ifund-growth-agent-preview` bundle; it already contains `strategyRoute` and `growthRoute`. The new single Worker dispatches both to those **in-process functions**, rather than to two downstream Workers.
- Bindings inherited by **name/type**, without printing values: `AI`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, both agents' `IFUND_*_ENABLED` and `IFUND_*_AI_ENABLED`. No payment, OAuth, email or D1 binding added.
- `workers.dev` **normal script route disabled**; per-version preview URLs enabled. No custom domain or Pages routes changed. No existing Workers deleted, redeployed or modified.
- Read-back verified both handlers, correct default dispatch and complete binding-name list. API deployment and new-version creation verified.
- The per-version preview address format from current Cloudflare docs is `<version-prefix>-<worker-name>.<subdomain>.workers.dev`; external accessibility and authenticated browser flows were **not** verified. Do not publish a preview URL as tested based on format alone.

## Verification to date
- Local Node test harness reconstructed the committed routing and source-builder contracts and reported 17/17 passing tests (both specialists, independent flags, unauthorized rejection, non-planning path isolation, outage behavior, source drift). This is a local unit smoke, **not** full hosted E2E, nor a GitHub CI check.
- Cloudflare deployed script readback SHA-256 matched the upload checksum exactly.
- No verified authenticated end-to-end Supabase report or AI inference tests for the new combined Worker. No owner-approved production promotion.

## Next integration sequence
1. Run safe request tests directly against the **version URL** from an approved browser/testing environment: GET `/health`, unauthenticated Strategy and Growth calls must return 401, payment/OAuth/send routes must return 404. Never paste credentials into issues.
2. Compare authenticated, consented Strategy and Growth `subscription`, `workspace`, `brief`, `bulk` request/response parity with their existing isolated preview Workers; ensure no shared write/receipt conflicts and preserve both distinct Supabase function namespaces. Avoid actual paid AI inference until free-tier budget confirmed.
3. Integrate through preview-only Pages service bindings with a reversible route change; route **both** planning capabilities to this single Worker after test evidence exists. Do not run both routes in multiple active schedulers; these agents have only fetch handlers.
4. Retain originals for rollback. Do not delete or disable them until verified parity and separate approval.
5. Do not replace Base44 runtime or promote production while frontend-first issue #203 gates remain unmet.

## GitHub source of truth
Lead branch `agent/lead-architecture`:
- `scripts/architecture/build-planning-composite-source.mjs` and tests (native single-worker builder; fails on source drift)
- `scripts/architecture/planning-composite-preview-worker.mjs` and tests (earlier safe facade, not the native merged runtime)
- `scripts/architecture/planning-agent-routing-contract.mjs` and tests (actual `/api/agents/*` paths and `enabled` flags)

The directly deployed bundle is generated from the existing Growth runtime and has the immutable checksum above. For any later refresh, re-inspect its exact upstream source and deploy a new preview version; never silently replace the current version.

## Hosted verification and cross-platform binding inventory — 2026-11-09 09:43 UTC

Cloudflare Browser Rendering fetched the immutable version URL `https://032d7d4b-ifund-planning-agent-preview.interplanetary-fund.workers.dev/health`: **HTTP 200**, JSON `{"service":"ifund-planning-agent-preview","strategy_enabled":true,"growth_enabled":true,"publishing":false}`. The same hosted probe fetched `/api/agents/growth/workspace` without a session: **HTTP 401** `{"error":"Sign in to use your assistant."}`. Other probe paths were throttled by Cloudflare Browser Rendering (HTTP 429), not validated. This is evidence of actual version URL reachability, not authenticated parity or publishing readiness.

Supabase production project `ssibsfmtodgximseeqsv` was **ACTIVE_HEALTHY**. Existing migrations `ifund_strategy_agent_contracts` and `ifund_growth_agent_contracts` were present. SQL catalog confirmed ten Strategy/Growth functions (begin, bulk, context, finish, workspace per agent); all `SECURITY INVOKER`, all denied EXECUTE to `anon`, and granted to `authenticated`. Grants alone do not prove row ownership; run RLS/claim tests with real authorized test accounts before route cutover.

Cloudflare Pages project `interplanetaryfund-migration` is GitHub-connected, production branch `main`, latest production deployment `edc70a63-a3fb-44cd-9333-a696545cac75` at the time of inspection. **Preview** service bindings currently target isolated Workers: `IFUND_STRATEGY_AGENT -> ifund-strategy-agent-preview`, `IFUND_GROWTH_AGENT -> ifund-growth-agent-preview`, `IFUND_STORY_AGENT -> ifund-story-agent-preview`, `IFUND_COMMUNICATIONS_AGENT -> ifund-communications-agent-preview`, `IFUND_CONNECTIONS_AGENT -> ifund-managed-connections-agent-preview`. **Production** binds only `IFUND_STORY_AGENT -> ifund-story-agent`. The preview Pages environment exposes names `NODE_VERSION`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`; production has these plus `NPM_VERSION`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL`. Values intentionally not recorded. Supabase URL and publishable key are client-safe; secret/service-role keys must remain server-only. These are *inventory*, not a request to duplicate keys into GitHub.

**Release decision:** leave both isolated preview bindings unchanged pending authorized functional parity. Combined Worker health and unauthenticated Growth rejection passed, but authenticated Strategy/Growth, source frontend parity, original Base44 preview, financial safety, and rollback drills are still unverified. No production or DNS changes.
