# Interplanetary Fund

**Official website:** https://interplanetaryfund.com

**Canonical application source:** https://github.com/interplanetarysister/InterplanetaryFund

React/Vite frontend, Supabase backend, and Cloudflare infrastructure. This repository is the independent migration destination. **Vercel and Convex links are historical, not deployment targets.**

- [Migration issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137)
- [Migration pull request #165](https://github.com/interplanetarysister/InterplanetaryFund/pull/165)
- [Original Base44 source repository (read-only functional reference)](https://github.com/interplanetarysister/interplanetary-fund2)
- [Original Base44 app (legacy; not the canonical production URL)](https://interplanetaryfund.base44.app)

The official domain is the intended public entry point, but the migration's user/admin, data, payment, and workflow acceptance tests must pass before cutting over or retiring Base44. A repository link does not prove the destination site is deployed.

Pre-migration Convex/Vercel/FundForge code remains historical reference material in git history and the `archive/pre-migration-2026-10-24` branch. Do not reuse old hostnames or secrets in new UI integrations.

## Development and release

Review `apps/web/DEPLOYMENT-GATES.md`, migration issue #137, and PR #165 before publishing. Use the canonical Supabase project and Cloudflare account only after verifying the intended environment and required approval gates. Keep production DNS, live payment processing, and Base44 unchanged until explicitly authorized.

The GitHub About → Website field is **repository metadata**, not part of this README. It must separately be changed from its old Vercel value to `https://interplanetaryfund.com` using repository settings or an authorized GitHub repository-administration API.
