# Issue #203 — canonical source drift and preview release gate (2026-11-09 UTC)

Owner: lead architecture. This is an architecture-only handoff on `agent/lead-architecture`; no frontend, backend, workflow, payment, or production files changed.

## Fresh source evidence

- Canonical frontend repository: `interplanetarysister/interplanetary-fund2@main` (original Base44 app).
- The previously documented source revision `f27c7f31576128d89ebbb5251711eaa8bd0db5e6` is **not current**. Comparison to main showed eight later commits affecting the original app's withdrawal/fee and migration paths, plus a later test-only change.
- A later issue #203 checkpoint pinned `2d7e02ef8447f136fd76b11f9be18b3952a82ae4`; a fresh comparison now finds **one additional commit** on main (in `scripts/test-fee-calc.mjs`). Latest commit search returned `0d8afce9ddd582845201a7ea56633eaf0b0f4f85` first. Re-fetch and verify the actual main HEAD immediately before dispatch; do not assume any SHA in this document remains current.
- The merged `.github/workflows/original-frontend-preview.yml` requires the supplied immutable SHA to equal current canonical main, preserving Base44 Vite configuration, and deploys to Cloudflare Pages branch `original-frontend-preview`. Thus dispatching with a stale SHA intentionally fails closed.

## Non-overlapping next actions

1. Frontend/deployment owner: obtain the **current** canonical main SHA, dispatch the registered workflow from deployable repository main with `source_ref=<current 40-character SHA>`, retain the run URL and immutable Cloudflare Pages preview URL, and confirm `/ifund-source.json` matches.
2. Frontend QA: compare the rendered mobile original UI, navigation, campaign wizard and assets; verify guest composition, auth return-to-draft, SPA deep links, and authorized Base44 reads/writes in preview. Do not infer functional parity from build or HTTP 200 alone.
3. Financial/backend QA: independently check the original-source fee changes against the **7% withdrawal fee**, ownership/RLS, and verified-payment safety. Do not change Base44 integrations as part of this frontend-first release.
4. Lead architecture: review resulting evidence and coordinate issue #203. Do not wholesale merge divergent agent branches or promote production without user approval and rollback evidence.

**Release status: HOLD** pending actual preview execution and authenticated browser acceptance. Existing Base44 runtime remains intact.
