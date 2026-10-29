# Interplanetary Fund — independent build

This repository contains the **independent, non-Base44** Interplanetary Fund application. Its runtime target is Supabase (Auth/Postgres/Storage) and Cloudflare (Pages/Workers). It is maintained separately from the Base44 version.

- Independent repository: `interplanetarysister/InterplanetaryFund`
- Separate source/reference repository: `interplanetarysister/interplanetary-fund2`
- Independent production domain target: `https://interplanetaryfund.com`
- Current implementation branch: `migration/build-completeness-gates-20261029`
- Current review: [Draft PR #165](https://github.com/interplanetarysister/InterplanetaryFund/pull/165)
- Main remains unchanged; no merge, production deployment, DNS change, data import, or provider mutation has been authorized.

## Current prebuild status

The independent app has a 59-route historical inventory: **44 routes have partial implementations, 15 remain placeholders, and 0 are release-verified**. The route inventory is not proof of full feature parity. The 95 entity, 184 function, 10 agent, 17 workflow, and 11 connector inventories are source mappings; they do not mean those services are fully ported or live. The canonical Supabase project currently has zero public campaigns and zero donation/payment-event rows; the 27 campaign shadows are in a separate legacy migration project, not in the canonical runtime. Of those shadows, 20 join to identity-map rows marked verified by exact confirmed-email matching and seven remain awaiting destination login; none has independently verified explicit owner-consent receipts.

Latest verified CI at commit `ea4e45f0019dcd64ec62f967360c14050f7b899d`:
- Worker/contract tests: **103 passed**
- Web regression tests: **130 passed**
- Inventory and backend-coverage audits: **passed**
- Runtime-boundary regression: **passed** (no Base44/Convex references in active app/Worker runtime or package/Worker config)
- Independent Vite compilation: **passed**
- Release-evidence gate: **intentionally blocks release** while owner, data, auth, legal, feature-parity, provider, and Android evidence remains incomplete.

This CI validates the code and compilation only. It does not establish live Supabase Auth, cross-account RLS, original feature parity, browser/mobile acceptance, data reconciliation, or production deployment. See [current migration status](docs/migration/STATUS.md), [blockers](docs/migration/BLOCKERS.md), and [deployment gates](apps/web/DEPLOYMENT-GATES.md).

## Local development

Use Node 22.x. From the repository root:

```sh
npm ci --no-audit --no-fund
npm test
npm --prefix apps/web test
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web exec -- vite build
```

The final command is a compile check. The normal `apps/web` build script invokes the production evidence gate and must remain blocked until the release evidence is genuinely complete. Do not bypass that gate to deploy.

Use only the canonical Supabase project and publishable browser key. Never expose service-role keys or provider secrets. No live data or credentials should be copied from the separate source app without explicit owner approval and verified reconciliation.

## Runtime boundaries

- No Base44 SDK, Base44 function proxy, or Convex runtime is used by the independent app.
- Base44/Convex mentions in migration documents are historical provenance, inventory, or retirement evidence only; they are not runtime configuration.
- Payments, donations, withdrawals, external posting, AI metered features, and automation execution remain disabled or unverified unless a separately reviewed implementation explicitly enables them.
- Preserve the independent app's own auth, database, storage, domain, deployment, and rollback identities. Do not overwrite this repository with the Base44 app export.
