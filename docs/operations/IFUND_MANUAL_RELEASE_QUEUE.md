# iFund cumulative release staging manifest

**Release hold started:** 2026-11-12 Pacific. **Status:** HOLD — SOURCE/QA ONLY; NO BUILD OR DEPLOY.

## Release identity and preservation

- **Canonical source:** `interplanetarysister/InterplanetaryFund` / `main`.
- **Frontend:** `apps/web` exclusively; historical root code and Base44 remain preserved.
- **Cloudflare Pages project:** `interplanetaryfund-migration`.
- **Last verified canonical production at hold:** `f866dc50-8283-4da5-a05b-f588820450da` at commit `9a332875d41a94645ba3b7a16b87eb6f438ef3a5`. This is a checkpoint, not proof of complete app functionality. Verify again at authorized release.
- **Cloudflare Git integration:** `deployments_enabled=false`, `production_deployments_enabled=false`, `preview_deployment_setting=none`. These must remain disabled after release.
- **GitHub:** all relevant automated build/verification workflow triggers changed to manual-only; one authorized Pages release entry point: `.github/workflows/deploy-web-pages.yml`.
- **Data:** Supabase project `ssibsfmtodgximseeqsv`, media R2 `ifund-media`. No release-control action may delete or reset data, source history, successful deployment artifacts, existing payment ledgers, or Base44 data.

## What accumulates on every code commit (without builds)

Agents add implementation, source/security review evidence, test cases, API/SQL/RLS checks, API contract changes, migration preflight, and regression notes to the canonical repository. Avoid duplicate solutions and overlapping agent changes. Do not request a Cloudflare build, GitHub Actions build, Worker deployment, manual Pages POST, npm bundling, or hosted preview during this hold.

Record for each work item: canonical commit/path, user behavior, affected Workers/Pages endpoints, DB migrations (applied vs pending), negative auth/ownership cases, data preservation, provider approvals, test additions, what has actually been executed, and unresolved blockers. Do not mislabel code inspection as runtime acceptance. A clean repository commit is not proof a deployment passed.

### Aggregation checklist for next authorized build

- [ ] Select exact immutable `main` SHA and inspect diff since last canonical production.
- [ ] Reconcile overlapping agent commits, fixtures and unresolved tests **before** building.
- [ ] Check any Supabase migrations were deliberately reviewed/applied, and verify financial/owner boundaries.
- [ ] Reconcile Cloudflare Worker source against deployed versions; Pages only publishes the frontend and Pages Functions, not all Worker services.
- [ ] Run the single manual release workflow when owner says **BUILD**. Run `apps/web` tests and compile **once** at the pinned SHA.
- [ ] Upload the **same** checked artifact to preview, smoke-test the preview and critical routes.
- [ ] Only with explicit **production/go-live** approval, upload the **same artifact** to the Pages production environment. Preview and production have separate Cloudflare deployment records but share the exact compiled files.
- [ ] Confirm production SHA/URL and inspect auth, RLS, upload, media, checkout, donation capture ledger, withdrawal gates, user sessions and mobile UI. Preserve rollback target.
- [ ] Keep Git-connected automatic deployment disabled afterwards.

## Important exclusions

This manual Pages release does not automatically deploy the PayPal payment Worker, demo/sandbox Worker, Supabase Edge Functions, Base44 app, native Android APK, or source database migrations. They require independent, authorized promotion and proof. A deployed frontend cannot certify these providers or cash movement.

## Execution authority

**Owner says "build"** = authorize one consolidated frontend preview build, not production by default.

**Owner explicitly says "production" or "go live" after preview checks** = authorize promotion of the same tested artifact to production.

Anything else (including an agent finishing its task, a PR merge, a scheduled automation or a new commit) = continue accumulating verification work with **zero builds**.
