# Independent release and deployment gates

## Owner authorization — effective 2026-10-30

The owner authorizes targeted tests, CI jobs, application builds, and deployments when reasonably necessary to implement, activate, or verify Interplanetary Fund repairs. This is repair authorization, not blanket production-cutover approval. Use the safest appropriate preview or production repair path, inspect changes and checks, preserve rollback capability, and verify the live result.

This authorization does not permit unrelated DNS changes, domain cutover, legacy route reassignment, payment/provider activation, or real financial transactions. Production release remains blocked until the project and runtime configuration mismatches below are resolved and the required parity gates are evidenced.

Current observed Cloudflare Pages settings for `interplanetaryfund-migration` are:

- `production_deployments_enabled=false`
- `preview_deployment_setting=none`

These are current observations, not a prohibition on a later repair deployment. Do not change DNS or route ownership as a side effect of a build or deployment.

## Current Cloudflare Pages state — read-only verification 2026-10-30

The Pages project currently reports production deployments disabled and preview deployments set to none. Its latest preview attempt is marked skipped with reason `preview_deployments_disabled`; no build or deploy stage ran for that attempt.

The last recorded canonical production deployment is historical: created 2026-10-29T01:32:29Z, with build and deploy stages completed successfully. It predates this current checkpoint and is not evidence of present platform-wide readiness.

Configuration drift remains unresolved and is intentionally untouched:

- The current Pages project source configuration names repository `interplanetary-fund2`.
- The recorded canonical deployment metadata names `InterplanetaryFund`.
- The configured Pages build command remains present, but deployment controls are disabled. It cannot safely deploy this migration branch until the repository source, canonical Supabase binding, and rollback path are reconciled. A repair-specific preview or production deployment is authorized after those checks.

The production Worker environment also remains mismatched: server-side `SUPABASE_URL` and `SUPABASE_JWKS_URL` point to the legacy project, while the browser Vite variables point to the canonical target project. The server-side secret binding is empty. No authenticated write path may be enabled until this is resolved through an authorized, independently verified configuration change.

## Current GitHub automation mode

The migration workflow runs:

- Root dependencies install with lifecycle scripts disabled.
- Worker and contract tests run with Node's test runner.
- Web dependencies install with lifecycle scripts disabled.
- Web regression tests and offline coverage audits run.
- Vite compiles the independent web app after regression tests.
- No deployment command is present in CI while the production route and project bindings remain mismatched.

The Vite step is a compilation check, not release approval or proof of browser, provider, Android, or production runtime behavior. Repair deployments are authorized when a safe target and rollback are verified.

## Required production gates

Production remains **NOT READY** until the release audit proves, from the actual target:

- All 59 historical routes and their original backend behavior.
- All 184 original backend functions and 398 known entity dependency edges.
- All 236 known direct frontend calls.
- All 17 workflow triggers, 10 agents, and 11 provider connectors.
- Complete source-data reconciliation and explicit Auth ownership mapping.
- First-time signup, email verification, login, and legal acceptance end to end.
- Actual `public.ifund_legal_acceptances` table, RLS, and Auth redirect/email configuration.
- Donor, withdrawal, dispute, and ledger safety.
- Android parity and independent browser/provider verification.

Static route shells, schema names, mocks, or passing unit tests are not runtime proof. Reconcile every repository migration against the live migration history before applying it. Existing source data without verified owner mappings must not be assigned to Auth users.

## Current checkpoint

- Draft PR: #165
- Working branch: `migration/build-completeness-gates-20261029`
- Current implementation commit: `3a183491340136ba2e7e9c57c7df3ed02d97113e`
- Build/CI/deployment repair authorization: **granted**
- Production readiness: **NOT READY**

Build and deploy when a repair requires it, but do not treat a green compile or unit suite as production readiness. Resolve the documented project mismatch and prove the full user-facing parity gates before cutover.
