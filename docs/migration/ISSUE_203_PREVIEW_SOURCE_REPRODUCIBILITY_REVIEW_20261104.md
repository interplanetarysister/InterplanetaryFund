# Issue #203 — original frontend preview integration review (2026-11-04 UTC)

Scope: lead architecture / review only. No frontend, backend, DNS, payment, or production changes are authorized by this document.

## Reviewed inputs

- Integration branch `migration/base44-frontend-parity-20261103` at `b0b17b837198dd85b9e40a99d6a8a681132c1b52`.
- Frontend branch `agent/frontend-parity`: 10 ahead / 1 behind integration, net files `.github/workflows/original-frontend-preview.yml` and `apps/web/src/pages/Home.jsx`.
- Lead branch `agent/lead-architecture`: 7 ahead / 1 behind integration before this review.
- Frontend workflow currently checks out `interplanetarysister/interplanetary-fund2@main` dynamically, runs `npm ci`, builds `dist`, injects Pages SPA fallback, and deploys to Cloudflare branch `original-frontend-preview`.

## Specific review findings and acceptance contracts

1. **Build-time checkout is not repository import.** The preview workflow deploys the original repository directly but does not add its pages/assets/components to the deployable repository. This is suitable as a temporary visual reference, not proof of source integration. Frontend owner must deliver an explicit source inventory and import strategy separately.
2. **Mutable source ref.** `ref: main` may change between reviews. Workflow logs the resolved SHA, but deployment evidence must retain the resolved original SHA, deployable workflow SHA, Cloudflare deployment ID, and exact URL together. Re-run parity checks when the source SHA changes. A reviewed pinned SHA is preferred for a reproducible release candidate.
3. **Preview environment contract.** Workflow requires `VITE_BASE44_APP_BASE_URL`, `VITE_BASE44_APP_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and source read access (`IFUND_SOURCE_READ_TOKEN` when needed). Verify presence without printing secret values. A successful static build does not verify Base44 cross-origin authentication or API access.
4. **Deep-link fallback.** Generated `dist/_redirects` handles Pages SPA routes only. Integration must test real preview paths and distinguish HTML fallback from missing JS/assets or API failures.
5. **Non-overlap.** Frontend owns source import and preview workflow; integration owns deployment/browser verification; backend owns API/auth/RLS and remains on existing Base44 bridge for this phase; lead owns architecture contracts and review. Do not merge divergent agent branches without inspecting their complete diffs and checks.
6. **Production hold.** Require screenshots or browser recordings at mobile viewports for original Home, discovery, campaign details, create/AI wizard, sign-in, guest draft preservation, and navigation, plus verified live Base44 data/auth behavior. Require owner approval and rollback plan before production promotion. No Base44 removal until the owner authorizes a whole dependency unit.

## Handoff

Frontend: publish a source-SHA-pinned preview and record Cloudflare URL/deployment ID; separately plan full original source import. Integration: run real HTTP/deep-link/asset smoke checks and interactive browser comparison against the original. Backend: test bridge/auth and negative security cases without changing live dependencies. Lead: review evidence and record gate status on #203.
