# iFund cumulative release staging manifest

**Release policy updated:** 2026-11-12 Pacific. **Status:** BUILDS AND VERIFIED DEPLOYMENTS AUTHORIZED WITHOUT REPEATED OWNER APPROVAL; MINIMIZE BUILD FREQUENCY.

## Release identity and preservation

- **Canonical source:** `interplanetarysister/InterplanetaryFund` / `main`.
- **Frontend:** `apps/web` exclusively; historical root code and Base44 remain preserved.
- **Cloudflare Pages project:** `interplanetaryfund-migration`.
- **Last verified canonical production at hold:** `f866dc50-8283-4da5-a05b-f588820450da` at commit `9a332875d41a94645ba3b7a16b87eb6f438ef3a5`. This is a checkpoint, not proof of complete app functionality. Verify again at authorized release.
- **Cloudflare Git integration:** `deployments_enabled=false`, `production_deployments_enabled=false`, `preview_deployment_setting=none`. Keep these disabled by default to suppress unnecessary Git-triggered builds; manually initiated consolidated builds and deployments are now authorized.
- **GitHub:** all relevant automated build/verification workflow triggers changed to manual-only; one authorized Pages release entry point: `.github/workflows/deploy-web-pages.yml`.
- **Data:** Supabase project `ssibsfmtodgximseeqsv`, media R2 `ifund-media`. No release-control action may delete or reset data, source history, successful deployment artifacts, existing payment ledgers, or Base44 data.

## Pre-build development and release batching

Agents add implementation, source/security review evidence, test cases, API/SQL/RLS checks, API contract changes, migration preflight, and regression notes to the canonical repository. Avoid duplicate solutions and overlapping agent changes. Source review, unit tests and repairs should precede release builds. Build/deploy only when a coherent group of changes is ready; a commit by itself is not a reason to trigger CI. Explicit owner BUILD permission is no longer required.

Record for each work item: canonical commit/path, user behavior, affected Workers/Pages endpoints, DB migrations (applied vs pending), negative auth/ownership cases, data preservation, provider approvals, test additions, what has actually been executed, and unresolved blockers. Do not mislabel code inspection as runtime acceptance. A clean repository commit is not proof a deployment passed.

### Aggregation checklist for next consolidated build

- [ ] Select exact immutable `main` SHA and inspect diff since last canonical production.
- [ ] Reconcile overlapping agent commits, fixtures and unresolved tests **before** building.
- [ ] Check any Supabase migrations were deliberately reviewed/applied, and verify financial/owner boundaries.
- [ ] Reconcile Cloudflare Worker source against deployed versions; Pages only publishes the frontend and Pages Functions, not all Worker services.
- [ ] Run a single manual release workflow once per coherent release batch, without asking for an additional BUILD command. Run `apps/web` tests and compile once at the pinned SHA.
- [ ] Upload the **same** checked artifact to preview, smoke-test the preview and critical routes.
- [ ] When preview, regression, data and payment safety gates pass, promote the **same artifact** to Pages production without requiring a second generic permission command. A blocked, unsafe or unverified release must not be promoted. Preview and production have separate Cloudflare deployment records but share the exact compiled files.
- [ ] Confirm production SHA/URL and inspect auth, RLS, upload, media, checkout, donation capture ledger, withdrawal gates, user sessions and mobile UI. Preserve rollback target.
- [ ] Keep Git-connected automatic deployment disabled afterwards.

## Important exclusions

This manual Pages release does not automatically deploy the PayPal payment Worker, demo/sandbox Worker, Supabase Edge Functions, Base44 app, native Android APK, or source database migrations. They require independent, authorized promotion and proof. A deployed frontend cannot certify these providers or cash movement.

## Execution authority and cost-control fallback

**Owner authorization (2026-11-12):** Build and deployment requests no longer need a separate express BUILD or production approval. Existing tasks may independently run tests and consolidated previews, then promote to production after successful evidence-based verification, without extra confirmation.

**Minimize builds:** Prefer source analysis, SQL preflight and targeted local tests; batch related fixes, check for an already-running or passing build at the same SHA, use one release coordinator to avoid concurrent builds, and reuse the identical compiled artifact for preview and production. Cloudflare Pages `build_config.build_caching=true` is enabled; Git-driven deployments remain disabled to prevent one build per commit. GitHub workflows remain manually dispatched and Cloudflare auto-deploy stays off by default to prevent per-commit build charges.

**Safety exclusions:** This does not authorize paid service upgrades, production DNS changes, disabling provider webhook verification, fabricated financial records, unsafe payout execution, destructive data migrations, or bypassing necessary compatibility/security checks. Hold the affected release when a required verification fails; do not demand fresh user permission merely to repair and rerun tests.