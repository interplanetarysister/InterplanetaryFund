# iFund cumulative release staging manifest

**Release policy updated:** 2026-11-12 Pacific. **Current policy (November 13):** blanket freeze removed; builds and releases follow explicit owner authorization and its conditions. See AGENTS.md.

## Release identity and preservation

- **Canonical source:** `interplanetarysister/InterplanetaryFund` / `main`.
- **Frontend:** `apps/web` exclusively; historical root code and Base44 remain preserved.
- **Cloudflare Pages project:** `interplanetaryfund-migration`.
- **Last verified canonical production at hold:** `f866dc50-8283-4da5-a05b-f588820450da` at commit `9a332875d41a94645ba3b7a16b87eb6f438ef3a5`. This is a checkpoint, not proof of complete app functionality. Verify again at authorized release.
- **Cloudflare Git integration:** `deployments_enabled=false`, `production_deployments_enabled=false`, `preview_deployment_setting=none`. Keep these disabled by default to suppress unnecessary Git-triggered builds; manually initiated consolidated builds and deployments require the applicable explicit authorization.
- **GitHub:** all relevant automated build/verification workflow triggers changed to manual-only; one authorized Pages release entry point: `.github/workflows/deploy-web-pages.yml`.
- **Data:** Supabase project `ssibsfmtodgximseeqsv`, media R2 `ifund-media`. No release-control action may delete or reset data, source history, successful deployment artifacts, existing payment ledgers, or Base44 data.

## Pre-build development and release batching

Agents add implementation, source/security review evidence, test cases, API/SQL/RLS checks, API contract changes, migration preflight, and regression notes to the canonical repository. Avoid duplicate solutions and overlapping agent changes. Source review, unit tests and repairs should precede release builds. Build/deploy only when a coherent group of changes is ready; a commit by itself is not a reason to trigger CI. The owner directive of November 13 removes the blanket release freeze. Source work and local verification proceed within the requested scope; builds, preview publications and production promotions follow their explicit authorizations and any attached QA conditions. A build request alone does not authorize publication. See AGENTS.md for the current permission rule.

Record for each work item: canonical commit/path, user behavior, affected Workers/Pages endpoints, DB migrations (applied vs pending), negative auth/ownership cases, data preservation, provider approvals, test additions, what has actually been executed, and unresolved blockers. Do not mislabel code inspection as runtime acceptance. A clean repository commit is not proof a deployment passed.

### Aggregation checklist for next consolidated build

- [ ] Select exact immutable `main` SHA and inspect diff since last canonical production.
- [ ] Reconcile overlapping agent commits, fixtures and unresolved tests **before** building.
- [ ] Check any Supabase migrations were deliberately reviewed/applied, and verify financial/owner boundaries.
- [ ] Reconcile Cloudflare Worker source against deployed versions; Pages only publishes the frontend and Pages Functions, not all Worker services.
- [ ] Only after the owner explicitly says **BUILD**, run the single manual release workflow once for the consolidated immutable SHA, test and compile `apps/web` once.
- [ ] Upload the **same** checked artifact to preview, smoke-test the preview and critical routes.
- [ ] Only after explicit **production/go-live** authorization, and after preview, regression, data and payment safety checks pass, promote the **same artifact**. Preview and production use separate deployment records, but the bundle is compiled once.
- [ ] Confirm production SHA/URL and inspect auth, RLS, upload, media, checkout, donation capture ledger, withdrawal gates, user sessions and mobile UI. Preserve rollback target.
- [ ] Keep Git-connected automatic deployment disabled afterwards.

## Important exclusions

This manual Pages release does not automatically deploy the PayPal payment Worker, demo/sandbox Worker, Supabase Edge Functions, Base44 app, native Android APK, or source database migrations. They require independent, authorized promotion and proof. A deployed frontend cannot certify these providers or cash movement.

## Execution authority and cost-control fallback

**Latest owner authorization (2026-11-13):** Build/deploy is on hold until the owner explicitly says BUILD; production promotion requires additional explicit approval. Any older broader deployment permission is superseded. Scheduled agents may continue code review and source improvements without deploying.

**Minimize builds:** Prefer source analysis, SQL preflight and targeted local tests; batch related fixes, check for an already-running or passing build at the same SHA, use one release coordinator to avoid concurrent builds, and reuse the identical compiled artifact for preview and production. Cloudflare Pages `build_config.build_caching=true` is enabled; Git-driven deployments remain disabled to prevent one build per commit. GitHub workflows remain manually dispatched and Cloudflare auto-deploy stays off by default to prevent per-commit build charges.

**Safety exclusions:** This does not authorize paid service upgrades, production DNS changes, disabling provider webhook verification, fabricated financial records, unsafe payout execution, destructive data migrations, or bypassing necessary compatibility/security checks. Hold the affected release when a required verification fails; do not demand fresh user permission merely to repair and rerun tests.
## Social Feed release acceptance — 2026-11-12 Pacific

- Merged social/community feature PR #285 at `d2bf49d3c2446f36e0c0ba70be1d154a9dd0df25`.
- Preview deployment `6512a202-fa28-498a-8fd8-cafc60d98374` from branch commit `2e1ed6608ce3a4d7855c74a6daab710568d11898`: 397/397 web tests, 1/1 PGlite migration test, successful Vite build and deployment.
- Applied the matching migration `ifund_social_community_20261113` to canonical Supabase `ssibsfmtodgximseeqsv`. Verified 2 native and 18 archived posts preserved, 9 social-related tables have RLS, reports and drafts were initially empty, and the public feed returns 20 rows.
- Social feed likes/replies/friends/reports/admin moderation/private drafts and published-blog links are present. Manual X/Bluesky compose is not provider API auto-publishing.
- Production release may use a single controlled Git-triggered build because the source project has no manual workflow-dispatch API exposed to the current integration; restore production and preview auto-deploy settings to disabled immediately once build is accepted. Preserve preceding production deployment `f866dc50-8283-4da5-a05b-f588820450da` for rollback.

## Consolidated agent-audit follow-up release (2026-11-12 Pacific)
- Eight original agent/prepublication migrations applied in canonical Supabase and their owner-specific grants verified. NEXUS cron created and active with zero preexisting opted-in subscriptions.
- PULSE notifications fixed to use per-recipient operation keys, FORGE experiment quota serializes concurrent requests.
- Prepublication owner edit screens include field-level navigation; NEXUS trends use only verified 7/30-day capture counts.
- Root PGlite release suite now covers both Social Feed and new-publication grandfathering. Production build must pass both and the `apps/web` regression suite before publication.
- Keep existing production deployment `58527559-a278-4cc7-ae48-9b2d88c9ede7` for rollback; restore Git-based automatic builds to disabled after this single release trigger.

## Owner-directed prepublication/agent improvement batch — source only

- The existing database 3,500-character new-publication trigger is verified. New stricter whitespace handling is staged in `20261113_ifund_prepublication_whitespace_alignment.sql`; not applied in this batch.
- Campaign-wide punctuation and redundancy review now covers title, summary and full story with reversible proposals, and can queue ALL finding IDs in bounded batches after verifying the draft is saved.
- New private editorial categories and owner feedback thread are staged in `20261113_ifund_editorial_campaignwide_discussions.sql`; independently verified AI peer discussion is **not** operational.
- NEXUS prioritizes unresolved editorial work; POLARIS adds field-linked guidance; ECHO source stages recorded/read receipt statistics. Do not treat read counts as proof of a message reply.
- LINK's single-provider selection was changed on main; **reconcile** the independently prepared larger `feature/connections-icon-hub-20261112` reference branch before any promotion, including its 46-provider coverage and OAuth safety checks.
- Test sources added; they have **not** been executed in this no-build turn. Use the cumulative release workflow only when owner authorizes one build.
