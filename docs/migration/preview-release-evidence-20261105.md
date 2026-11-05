# Preview release evidence and promotion gates — 2026-11-05 UTC

## Verified deployment records

Cloudflare Pages project `interplanetaryfund-migration` deployed `agent/frontend-parity` commit `a7c34ea4c661c304c4a340c9b8c43f081c7172da` successfully as `3aac28ac-b662-4b8c-96c0-0aa74339ee42` (`https://3aac28ac.interplanetaryfund-migration.pages.dev`). This proves build/deploy status only, not original Base44 UI parity. Prior builds `bae0038c` and `732beac3` failed during tests/build. Backend branch deployment `ffe941b1` remained queued/idle at the time of review.

## Source of truth and non-overlap

Canonical frontend is `interplanetarysister/interplanetary-fund2@main`, with its `src/`, `public/`, routes, visual assets and `src/api/base44Client.js` preserved for the frontend-first phase. The `apps/web` reconstructed frontend in `InterplanetaryFund` is not sufficient evidence of original-source parity. Frontend owner ports assets/pages on `agent/frontend-parity`; backend owner works in `agent/backend-migration`; integration owner merges only reviewed work into `migration/base44-frontend-parity-20261103`. Lead branch owns architecture and release evidence only.

## Required evidence before production

1. Pin original source commit SHA and enumerate imported route/component/asset coverage, including mobile navigation, space background, campaign globe, discovery, AI campaign wizard (five titles, two short descriptions, one story with section regeneration, image upload/generation).
2. Verify browser-rendered preview visually against original APK/source at mobile widths; check guest browsing and draft composition, sign-in on save/publish, return-to-draft, password recovery, deep links and no redirect loops.
3. Confirm original Base44 SDK/auth/data/functions calls continue to work from the preview; **do not remove them yet**. Later migrate one complete dependency unit only after owner selection and authorization.
4. Validate deployed JS/CSS/media content types and routing, run test suites and security/RLS/owner-only financial controls; no simulated payments or 3% donor-side fee. Contract is 7% deducted at withdrawal.
5. Verify production branch build provenance, rollback target, domain routing, and safe Cloudflare Pages production deployment; do not change DNS or retire Base44 until gates pass.

## Current decision

**NO-GO** for production: deployed preview status alone does not prove restored original UI, runtime connectivity or complete core workflows. Continue frontend port and functional verification; record browser screenshots and failing route evidence on issue #203.
