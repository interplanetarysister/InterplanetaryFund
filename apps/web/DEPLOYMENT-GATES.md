# Independent release and deployment gates

## Owner authorization — effective 2026-10-30

The owner authorizes targeted tests, CI jobs, application builds, and deployments when reasonably necessary to implement, activate, or verify Interplanetary Fund repairs. This is repair authorization, not blanket production-cutover approval. Use the safest appropriate preview or production repair path, inspect changes and checks, preserve rollback capability, and verify the live result.

This authorization does not permit unrelated DNS changes, domain cutover, legacy route reassignment, payment/provider activation, or real financial transactions. Production release remains blocked until the project and runtime configuration mismatches below are resolved and the required parity gates are evidenced.

Current observed Cloudflare Pages settings for `interplanetaryfund-migration` are:

- `production_deployments_enabled=false`
- `preview_deployment_setting=none`

These are current observations, not a prohibition on a later repair deployment. Do not change DNS or route ownership as a side effect of a build or deployment.

## Current Cloudflare Pages state — verified 2026-11-09

The active preview target is Cloudflare Pages project `interplanetaryfund-migration`.

Observed project configuration:

- GitHub source: `interplanetarysister/InterplanetaryFund` (repository ID `1326040927`).
- Production branch: `main`.
- Production deployments: disabled.
- Preview deployment setting: `custom`.
- The preview branch allowlist includes `feature/ifund-campaign-donation-ux-20261103`.
- Build root: `apps/web`.
- Build command: `npm ci --no-audit --no-fund && npm test && npm run build`.
- Attached domains: `interplanetaryfund.com`, `www.interplanetaryfund.com`, and `preview.interplanetaryfund.com`, as well as the project's `pages.dev` domain.

The generated branch-preview URL is the verified target for this repair. The custom-domain attachment does not by itself prove that `preview.interplanetaryfund.com` resolves to this branch deployment. No DNS, custom-domain, production-branch, or production-deployment setting was changed.

## Current GitHub automation mode

The migration static-check workflow:

- Installs locked root dependencies with lifecycle scripts disabled.
- Runs worker and contract tests.
- Installs locked web test dependencies with lifecycle scripts disabled.
- Runs web regression tests and offline coverage audits.
- Syntax-checks Worker JavaScript without compiling or deploying it.

The separate `web-preview-build.yml` workflow runs the web regression suite and compiles the Pages bundle. It contains no deploy command; Cloudflare Pages performs the branch-preview build and deployment from the allowlisted GitHub branch.

The `verify-build-mode.mjs` gate selects the inventory-consistency check for a non-production Cloudflare Pages branch. Local builds and the `main` production branch retain the strict production evidence gate. A successful preview build is not production release approval.

## Canonical Supabase and migration safety — verified 2026-11-09

The canonical Supabase project is `ssibsfmtodgximseeqsv`. Its live migration history already contains the newer campaign-funding aggregate and donation-support migrations. The older staged drafts `20261103150000` and `20261103160000` have therefore been converted to inert migration markers; they no longer replace the live funding RPC or narrow the existing optional-support ceiling.

The previously applied `20261025100627` schema migration is restored to its original grant block. The repository now carries the later `20261105193521` campaign write-privilege hardening migration separately, preserving the live column-scoped insert/update grants and RLS-constrained delete permissions.

The public funding RPC's existing `donor_count` field counts captured gift rows, not unique people. The web client now presents that aggregate as a gift count and does not label it as unique donors. This is a presentation correction; no donor records or database rows were changed.

No Supabase migration was executed during this preview repair. The preview uses the canonical project bindings already configured in Pages; no service-role key was added.

## Required production gates

Production remains **NOT READY** until the release audit proves, from the actual target:

- All 59 historical routes and their original backend behavior.
- All 184 original backend functions and 398 known entity dependency edges.
- All 236 known direct frontend calls.
- All 17 workflow triggers, 10 agents, and 11 provider connectors.
- Complete source-data reconciliation and explicit Auth ownership mapping.
- First-time signup, email verification, login, and legal acceptance end to end.
- End-to-end signup, email verification, login, and legal acceptance. The `public.ifund_legal_acceptances` table and owner-scoped RLS now exist, but there are zero acceptance rows and browser completion is unverified; Auth redirect/email configuration remains to be proven.
- Donor, withdrawal, dispute, and ledger safety.
- Android parity and independent browser/provider verification.

Static route shells, schema names, mocks, or passing unit tests are not runtime proof. Reconcile every repository migration against the live migration history before applying it. Existing source data without verified owner mappings must not be assigned to Auth users.

## Current checkpoint

- Open PR: #200
- Working branch: `feature/ifund-campaign-donation-ux-20261103`
- Deployed application code commit: `1b9ab7f8382a2928ef4b942f72f9e6e7689adfb6`.
- Root worker and contract tests: 152 passed, 0 failed.
- Web regression and offline coverage tests: 166 passed, 0 failed.
- Vite preview bundle compilation: passed (6.66 seconds).
- Cloudflare Pages preview deployment: success.
- Unique preview URL: https://633212d3.interplanetaryfund-migration.pages.dev
- Branch preview alias: https://feature-ifund-campaign-donat.interplanetaryfund-migration.pages.dev
- Production deployment: disabled.
- Production readiness: **NOT READY**.

The deployment-gate document itself may receive a documentation-only follow-up commit; the application code identified above is the version verified and deployed in preview.

Do not merge to `main`, enable production deployments, alter DNS, activate PayPal checkout, or apply database migrations as part of this preview-only repair. A green preview build and unit suite do not prove end-to-end authentication, provider, payment, withdrawal, agent, Android, or production runtime parity.
