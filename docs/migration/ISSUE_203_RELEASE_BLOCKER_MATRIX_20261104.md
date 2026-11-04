# Issue #203 — frontend-first release blocker matrix (2026-11-04 UTC)

Scope: lead-architecture coordination only. Source of truth for UI is `interplanetarysister/interplanetary-fund2@main`; deployable repository is `interplanetarysister/InterplanetaryFund`. This document does not authorize backend migration or production promotion.

## Verified repository evidence

- At review, integration ref `migration/base44-frontend-parity-20261103` points to `b0b17b837198dd85b9e40a99d6a8a681132c1b52`.
- `agent/frontend-parity` diverged: 10 commits ahead, 1 behind integration. Its net changed files are only `.github/workflows/original-frontend-preview.yml` and `apps/web/src/pages/Home.jsx` (3 additions, 3 deletions). **A workflow that checks out the original repository at build time is not an imported frontend in the deployable branch.**
- `agent/lead-architecture` diverged: 6 commits ahead, 1 behind integration. Its changed files are architecture docs and audit workflow only.
- Integration owns `scripts/verify-isolated-preview.mjs`, a limited HTTP/deep-link/asset probe; passing it is not visual or functional parity.

## Dependency-ordered gates and owner handoffs

| Gate | Owner | Evidence required before marking done |
| --- | --- | --- |
| A. Source identity | Frontend | Pin original `interplanetary-fund2@main` SHA in workflow/build output, verify complete original `src/`, `public/`, package lock and assets are used; avoid silently substituting `apps/web` reconstruction |
| B. Isolated deployment | Frontend + Integration | Successful Cloudflare Pages preview with URL, deployment ID, commit SHA, root/build command, environment variable names (never values), and asset checks |
| C. Mobile parity | Frontend + Integration | Side-by-side mobile viewport evidence against original app for home, browse, campaign detail, create wizard, login, and navigation; record route/asset gaps |
| D. Working Base44 bridge | Frontend + Backend QA | Preview can browse real non-sensitive campaign data and exercise existing Base44-connected flow without broken auth/CORS/redirects; no SDK removal in this phase |
| E. Guest and account flows | Integration + Backend QA | Guest browse/compose, draft retention across login, recovery, account ownership/RLS negative tests, and no leaked owner financial controls |
| F. Financial safety | Backend QA | Confirm withdrawal-only 7% platform fee, owner-only withdrawal, fail-closed provider capture, no simulated success; issue #201 blocks conflicting 3% donation UX |
| G. Promotion decision | Integration + Owner | All evidence linked on issue #203; rollback to known Cloudflare deployment and backend compatibility documented; **explicit owner approval** before production |

## Current release decision

**HOLD** production and Base44 replacement. A successful build or HTTP 200 cannot close gates A–G. Avoid merging finance PR #200 until issue #201 is resolved. Do not force-push, reset, rebase or edit other agents' branches. Frontend owner should first publish source-pinned isolated preview evidence; integration should then run its probe and browser tests. Backend changes remain separately staged until the owner authorizes each complete dependency unit.
