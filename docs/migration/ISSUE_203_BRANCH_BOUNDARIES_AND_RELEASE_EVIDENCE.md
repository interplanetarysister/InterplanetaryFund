# Issue #203 — lead review of branch boundaries (2026-11-03)

This is a source-control review, not a preview or production sign-off.

## Observed branch state
- Compared `migration/base44-frontend-parity-20261103` to `agent/lead-architecture`: lead branch is 3 commits ahead, 0 behind. Changed files are documentation and `.github/workflows/audit-canonical-frontend.yml` only.
- Compared integration to `agent/frontend-parity`: frontend branch is 6 commits ahead, 0 behind. GitHub compare reports only `.github/workflows/original-frontend-preview.yml` and `apps/web/src/pages/Home.jsx` as changed files. **No original source tree import is shown in that diff.**
- These two branch diffs are disjoint. This is not permission to merge unreviewed work: review the PR checks, source build provenance and preview first.

## Required evidence before original-frontend parity sign-off
1. Pin original `interplanetary-fund2@main` commit SHA and inventory its pages, components, public assets, package scripts, and original Vite plugin.
2. Prove the deployed preview was built from the original app's source tree and dependencies, rather than the reconstructed `apps/web` UI; retain working Base44 runtime during this frontend-first phase.
3. Confirm the preview URL and Cloudflare deployment commit, then inspect homepage background, routes, navigation, 360px/390px mobile layout, safe areas, scrolling, and asset requests.
4. Exercise guest browsing, guest draft composition, login on save/post, return-to-draft, password recovery, and an actual Base44-backed campaign read. Record failures and sanitized network status codes.
5. Run original build lifecycle checks, repository tests, SPA deep-link fallback, authorization/RLS checks, and financial fail-closed regression tests. The 7% fee is deducted at withdrawal; withdrawals are owner-only. Do not activate live payments.
6. Keep preview isolated from production domain routing; document rollback to the last known-good deployment before any production promotion. Production requires explicit owner approval.

## Ownership handoff
Frontend owns the original React/Vite app and visual assets. Integration owns preview build provenance and merge validation. Backend preserves existing Base44 connections until an individually authorized full dependency-unit migration. Lead reviews cross-boundary contracts and release evidence; no direct edits to other owners' branches.

## Current decision
**Not approved for production.** GitHub branch comparison alone cannot establish a successful original-source preview or working runtime parity.
