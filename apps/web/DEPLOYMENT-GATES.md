# IFund independent web prebuild and deployment gates

## Current independent build

- Repository: `interplanetarysister/InterplanetaryFund`
- Current implementation branch: `migration/build-completeness-gates-20261029`
- Review: [Draft PR #165](https://github.com/interplanetarysister/InterplanetaryFund/pull/165)
- Frontend root: `apps/web`
- Runtime target: Supabase + Cloudflare Pages/Workers
- Production domain target: `https://interplanetaryfund.com`

No production deployment, DNS change, migration import, schema application, provider mutation, or Base44 shutdown has occurred as part of this work. Do not infer current Cloudflare production settings from this document; re-read the account and deployment configuration before any later release action.

## Verified CI at commit `ea4e45f0019dcd64ec62f967360c14050f7b899d`

- Node setup: 22.23.2
- Worker and contract suite: **103/103 passed**
- Web regression suite: **130/130 passed**
- Inventory consistency and backend coverage audits: **passed**
- Runtime-boundary scan: **passed** (no legacy runtime SDK/config references)
- Independent Vite compilation: **passed**

The CI compile step runs Vite directly after installing the web dependencies. This is a compilation check, not release approval or a deployed artifact. The normal `npm run build` invokes `prebuild` and the release evidence gate. That gate must continue to fail while required evidence is missing.

## Remaining release blockers

1. **Feature parity:** 59 historical routes are mapped; 44 remain partial, 15 remain placeholders, and none is release-verified. Full user-facing parity and all source backend behaviors are not proven.
2. **Authentication:** real first-time signup, email delivery/redirect, callback, session persistence, password reset, second login, cross-device, and admin-role browser tests are not complete. Supabase Auth redirect/template/SMTP configuration has not been verified.
3. **Legal consent:** the independent consent migration is staged, not applied; real authenticated owner insert, cross-user isolation, immutable timestamps, and two-user browser tests are unverified.
4. **Data and ownership:** 27 staged campaigns have no verified auth-owner links; source row hashes and complete source campaign reconciliation are outstanding. No runtime import is approved.
5. **Backend and automation:** 184 source functions, 10 agents, 17 workflows, and 11 connectors are inventoried, but none is certified fully operational. Scheduled execution and external side effects remain disabled.
6. **Campaign creation:** content-only drafts and publishing are implemented; full source parity, AI copy choices/story generation, image generation, media storage, and campaign lifecycle proof remain incomplete.
7. **Payments:** checkout, donations, webhook authenticity, ledger settlement, withdrawals, and provider accounting are not release-verified. Keep financial actions paused.
8. **Android:** native source, signing identity, asset links, deep links, permissions, and signed artifact are not verified.
9. **Preview and production infrastructure:** independently verify Cloudflare Pages/Workers bindings, Supabase project cohesion, auth redirect allowlists, custom-domain routing, rollback, and real route smoke tests before any release. Do not switch DNS as part of preparation.

## Commands used by CI

```sh
npm ci --no-audit --no-fund
node --test tests/*.test.js
npm --prefix apps/web test
npm --prefix apps/web install --no-package-lock --ignore-scripts --no-audit --no-fund
npm --prefix apps/web exec -- vite build
```

The app dependency install currently has no committed app-specific lockfile; resolve and commit a reproducible lockfile before treating dependency installation as fully release-certified. The compile step does not replace browser, RLS, provider, or mobile testing.

## Production cutover

No cutover is permitted until every release blocker above is resolved with evidence, the owner approves the release plan, production deployment is tested on a separate preview route, and a rollback target is verified. Keep the independent build and Base44 version in separate repositories and preserve both identities.


## Read-only Cloudflare configuration audit — 2026-10-29

The connected Cloudflare account was inspected without changing settings.

- Pages project `interplanetaryfund-migration` is connected to this repository and has `interplanetaryfund.com`, `www.interplanetaryfund.com`, and `preview.interplanetaryfund.com` attached.
- Its configured production branch is `main`; production deployments are disabled. Preview deployments are also disabled (`preview_deployment_setting: none`). The latest attempted preview for the current migration branch was skipped because preview deployments are disabled.
- The last canonical production deployment observed was created from `main` commit `658dc2c88183c8297a6e107eee49b79ef7a5bf49` on 2026-10-29. It is not this current migration branch.
- The Pages build configuration is rooted at `apps/web`, with `npm install --no-audit --no-fund && npm test && npm run build`.
- **Critical project mismatch:** browser `VITE_SUPABASE_URL` points at `ssibsfmtodgximseeqsv`, while production Worker-side `SUPABASE_URL` and `SUPABASE_JWKS_URL` point at `tzehxfikoslihnclhxuz`. These are different Supabase projects. Do not deploy or enable Worker/API routes until all server and browser bindings are intentionally aligned and independently verified.
- The deployed Worker `interplanetary-fund2` still owns **16** active apex/www routes. The independent API code in this repository is not established as the active route owner. Pages reports `uses_functions: false`.
- No Cloudflare settings, routes, deployments, DNS, bindings, or secrets were modified during this audit. Secret values were not read or recorded.

This audit is a hard prebuild blocker. Do not enable preview or production deployments merely to obtain a green build: first reconcile the project references, determine which legacy routes are still required, and prepare a reversible preview route that cannot disturb the current site.
