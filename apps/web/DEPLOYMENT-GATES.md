# IFund independent web prebuild and deployment gates

## Current independent build

- Repository: `interplanetarysister/InterplanetaryFund`
- Current implementation branch: `migration/build-completeness-gates-20261029`
- Review: [Draft PR #165](https://github.com/interplanetarysister/InterplanetaryFund/pull/165)
- Frontend root: `apps/web`
- Runtime target: Supabase + Cloudflare Pages/Workers
- Production domain target: `https://interplanetaryfund.com`

No production deployment, DNS change, migration import, schema application, provider mutation, or Base44 shutdown has occurred as part of this work. Do not infer current Cloudflare production settings from this document; re-read the account and deployment configuration before any later release action.

## Verified CI at commit `87fe408ac7b8fab4cf0eeabbab219ae67cee8233`

- Node setup: 22.23.2
- Worker and contract suite: **102/102 passed**
- Web regression suite: **130/130 passed**
- Inventory consistency and backend coverage audits: **passed**
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
