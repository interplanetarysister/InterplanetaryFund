# Independent release and deployment gates

## Highest-priority owner override — effective 2026-10-29

No builds or deployments may be initiated unless the owner gives a new direct instruction naming the specific build or deployment. This prohibition includes npm/Vite builds, Cloudflare Pages or Workers builds, GitHub Actions build jobs, deployment retries, and indirect build triggers.

Cloudflare Pages project `interplanetaryfund-migration` must remain:

- `production_deployments_enabled=false`
- `preview_deployment_setting=none`

Do not change these settings, switch DNS, change legacy routes, change the connected repository, or activate payment/provider paths. Do not commit to a branch unless its resulting automation is verified to be test-only and non-deploying.

## Current Cloudflare Pages state — read-only verification 2026-10-30

The Pages project currently reports production deployments disabled and preview deployments set to none. Its latest preview attempt is marked skipped with reason `preview_deployments_disabled`; no build or deploy stage ran for that attempt.

The last recorded canonical production deployment is historical: created 2026-10-29T01:32:29Z, with build and deploy stages completed successfully. It predates this current checkpoint and is not evidence of present platform-wide readiness.

Configuration drift remains unresolved and is intentionally untouched:

- The current Pages project source configuration names repository `interplanetary-fund2`.
- The recorded canonical deployment metadata names `InterplanetaryFund`.
- The configured Pages build command remains present, but deployment controls are disabled. Do not invoke it or alter the project configuration.

The production Worker environment also remains mismatched: server-side `SUPABASE_URL` and `SUPABASE_JWKS_URL` point to the legacy project, while the browser Vite variables point to the canonical target project. The server-side secret binding is empty. No authenticated write path may be enabled until this is resolved through an authorized, independently verified configuration change.

## Current GitHub automation mode

The migration workflow has been changed to test-only:

- Root dependencies install with lifecycle scripts disabled.
- Worker and contract tests run with Node's test runner.
- Web dependencies install with lifecycle scripts disabled.
- Web regression tests and offline coverage audits run.
- No Vite build, npm build, Wrangler deployment, or Pages deployment command is present in either migration workflow.

A regression test checks the workflow files for forbidden build/deployment commands. These tests are not a build and do not prove browser, provider, Android, or production runtime behavior.

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

Static route shells, schema names, mocks, or passing unit tests are not runtime proof. Pending SQL migrations remain unapplied. Existing source data without verified owner mappings must not be assigned to Auth users.

## Current checkpoint

- Draft PR: #165
- Working branch: `migration/build-completeness-gates-20261029`
- Current branch head before this documentation update: `276d3e5c54189d58d3689fb4ae3554c4ba1a3733`
- Build/deployment authorization: **not granted**
- Production readiness: **NOT READY**

If a build would ordinarily be needed to verify a repair, continue source review, static analysis, targeted unit tests, security review, and independent data reconciliation instead. Record runtime validation as pending and proceed to the next independent task.
