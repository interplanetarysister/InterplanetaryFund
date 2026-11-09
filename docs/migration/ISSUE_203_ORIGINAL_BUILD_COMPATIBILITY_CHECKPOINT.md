# Original frontend import — verified source/build compatibility checkpoint (2026-11-03)

Source: `interplanetarysister/interplanetary-fund2@main` (read-only reference). Destination: `interplanetarysister/InterplanetaryFund`. Authoritative coordination: issue #203.

## Verified from source files
- Original `src/App.jsx` uses React Router, AuthProvider, ProtectedRoute, original page imports, and a broad lazy-loaded page graph (including GlobalGlobe, AIImageStudio, CreateCampaign, Withdrawals, inbox, social, and administrative tools).
- Original `vite.config.js` imports `@base44/vite-plugin` and retains a build-time cyclic-chunk guard plus custom dependency chunk rules. Removing that plugin before a replacement is authorized would break the frontend-first contract.
- Original `package.json` contains a `prebuild` runtime-minimum verification and a substantial `postbuild` chain (build stamp, output/bundle/asset checks, mobile, permissions, financial safety and provider checks). Importing only `src/` without the original scripts and required dependencies is **not** a faithful runnable transplant.
- Deployable repository root `package.json` currently has a much smaller dependency set and no matching original `postbuild` verification chain. Its root `vite.config.js` is a basic React Vite build, so original source cannot be assumed to compile there unchanged.
- Existing Cloudflare Pages configuration (verified separately) builds `apps/web` with `npm ci && npm test && npm run build` and publishes `dist`. This is the reconstructed UI path, not the original root `src/App.jsx` by default.

## Concrete handoffs, without overlapping ownership
1. **Frontend owner**: preserve original package scripts, lockfile, Vite plugin and route/assets graph as a cohesive unit in the frontend-owned branch. Record any necessary Cloudflare-specific Vite adaptation explicitly. Keep working Base44 connections intact.
2. **Integration owner**: configure a **preview-only** build that actually targets the imported original root, with its own root_dir/build_command/output; inspect the resulting deploy commit and HTML/assets. Do not mistake a successful `apps/web` preview for restored original UI.
3. **Backend owner**: no Base44 SDK/function replacement until the owner defines the first full functional dependency unit. Continue read-only auth/RLS checks and backend regression tests independently.
4. **Lead reviewer**: require evidence of original page import parity, successful npm lifecycle scripts, 360px/390px mobile smoke, SPA fallback, and real Base44-backed interactions before recommending merge.

## Release safety
No production deployment, DNS changes, live payment activation, or Base44 retirement without user approval and verified preview parity. A passing build or a Pages deployment record alone does not establish functional parity.
