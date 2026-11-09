# Issue #203 — original-preview provenance and acceptance handoff (2026-11-04)

Owner: lead architecture. This is a review artifact, **not** a deployment authorization or an assertion of functional parity.

## Source and deployment boundary

The frontend-owned `.github/workflows/original-frontend-preview.yml` checks out **interplanetarysister/interplanetary-fund2** at a supplied immutable 40-character SHA, runs `npm ci` and `npm run build`, and deploys its `dist/` to Cloudflare Pages project `interplanetaryfund-migration` on branch `original-frontend-preview`. This is an **isolated source checkout** and does **not** import the original source files into the deployable `InterplanetaryFund` integration branch. Do not represent the two as equivalent.

The workflow requires GitHub variables `VITE_BASE44_APP_BASE_URL` and `VITE_BASE44_APP_ID`, and Cloudflare credentials via GitHub secrets. It writes `/ifund-source.json` containing source repository, source SHA, `base44-preserved`, and `preview-only`. No credential values should be copied to reports. The generated Pages `_redirects` preserves SPA deep links. Verify that the original frontend's Base44 CORS/origin settings permit the **actual unique preview hostname** before declaring connected functionality.

## Acceptance handoff to integration QA

1. Fetch `https://<deployment>.interplanetaryfund-migration.pages.dev/ifund-source.json` from a browser-capable environment and compare `source_commit` to the original source commit actually checked out. A Cloudflare successful deployment state is insufficient.
2. Confirm homepage HTML, actual JS/CSS MIME types, manifest, favicon, install icon, and direct `/login` navigation; reject SPA HTML fallbacks masquerading as assets.
3. Capture 390px mobile screenshots and functional recordings of original homepage, navigation, discovery, campaign detail, guest creation wizard, and auth. Compare to the original Base44 app, including images and interaction sequence.
4. Exercise Base44-backed non-sensitive campaign discovery from preview and inspect browser console/network for CORS, redirect, CSP, and runtime errors. Never claim a live Base44 connection from a successful static asset check.
5. Confirm guest browse and in-memory draft composition; authentication required only when saving/publishing; draft state survives sign-in return. Verify password recovery in the hosted environment and ownership negative tests separately.
6. Keep financial actions disabled until verified provider webhooks, RLS, owner-only withdrawals, and the user-approved **7% fee deducted at withdrawal** are established. Do not merge conflicting donation-fee behavior.

## Release decision

**HOLD production.** The original preview may be independently deployed, but branch integration, browser-level parity, and authenticated Base44 behavior must each be proven separately. Preserve the working Base44 SDK/auth/functions during frontend restoration. Do not replace a dependency unit until the owner defines and authorizes it. Integration QA owns safe merging after review; lead architecture does not edit frontend/backend-owned files, other agents' branches, or production. Prepare rollback to a known Pages deployment before requesting explicit owner approval for production.
