# Frontend-first release contract — 2026-11-05

Authority: [issue #203](https://github.com/interplanetarysister/InterplanetaryFund/issues/203). Canonical source: `interplanetarysister/interplanetary-fund2@main`. Deployment repository: `interplanetarysister/InterplanetaryFund`. This is a coordination contract, **not** evidence of a successful release.

## Non-overlapping ownership

- Frontend owner (`agent/frontend-parity`): import original app pages, assets, layout, routes, styles, campaign wizard, and mobile interactions. Keep functioning Base44 client/runtime and credentials via existing secure configuration until the owner selects a complete dependency unit to migrate. Do not replace the canonical UI with the reconstructed `apps/web` app.
- Backend owner (`agent/backend-migration`): preserve and test existing Workers, Supabase RLS, ledger, and auth in isolation. No Base44 removal or user-facing adapter cutover until explicit unit authorization. No live payment activation.
- Lead architect (`agent/lead-architecture`): inventory, integration contracts, review and documentation only; no edits to frontend/backend-owned files.
- Integration/QA (`migration/base44-frontend-parity-20261103`): review and integrate PRs deliberately, check conflicts and CI, deploy preview, execute browser parity tests, and gate production. Do not merge ahead/behind branches blindly.

## Release acceptance sequence

1. Pin the original source SHA and enumerate route, asset, font, navigation, campaign wizard and auth entrypoints against the source tree. Record import exclusions and reasons; do not silently drop any original page.
2. Build the **original** frontend on Cloudflare Pages preview, using its actual build output. Confirm that the preview deployment commit contains the original app, not merely a successful reconstructed-app build.
3. Verify homepage, discover, campaign detail, creation wizard (five AI titles, two descriptions, one long story with section regeneration), art upload/generation, navigation, mobile safe areas and scrolling against original screenshots/video. Guest can browse and compose; save/post requires sign-in and returns to the draft.
4. Verify the retained Base44 runtime from the deployed preview with safe, read-only network checks and non-financial sandbox flows. Never report connectivity solely from the presence of SDK imports.
5. Verify deep links and hashed assets. Avoid Cloudflare Pages `/* /index.html 200` redirect rewrites where they cause loops; use tested native SPA fallback and compare HTTP 200 content with expected shell. Existing `scripts/verify-preview-http.mjs` is a *partial* gate only.
6. Test password sign-in, recovery code/link, OAuth redirects, account authorization, owner-only financial access, idempotent verified donations and 7% fee at withdrawal. Missing SMTP or hosted credentials are blockers, not passing tests.
7. Capture passing CI, deployment URL, source and target SHAs, screenshots, functional evidence, and rollback plan. Request explicit owner approval before production deployment, DNS changes, or Base44 retirement.

## Handoff and conflict protocol

Before editing, fetch the latest branch head and open PRs. Review changed filenames, existing interfaces and deployment workflows. Only additive commits on the assigned branch; no force pushes, resets, rebases, or unilateral edits to another agent's files. For shared files, propose an interface or patch in issue #203 and let the owner land it. QA integrates only reviewed changes after passing tests. Stop only the conflicting edit and continue independent work.

**Current caution:** A Cloudflare Pages success is not proof of original frontend parity, functioning Base44 APIs, authentication or correct DNS. Keep production and Base44 intact until all acceptance gates are evidenced.
