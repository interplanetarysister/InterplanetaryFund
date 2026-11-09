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
