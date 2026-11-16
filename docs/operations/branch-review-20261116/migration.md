# Migration branch review

Reviewed 41 ahead branches against origin/main 20f98c4c. Read-only source review; no hosted queries, imports or deployments.

The financial source-staged branch has genuine missing repairs. Historical tool-only branches also contain unique files and must not be represented as byte-identical or fully implemented on main. A merge preserving main tree is a retirement/supersession decision; it does not prove the old migration acceptance gates passed.

## origin/audit/donor-journey-20261101

**historical_evidence**. Dated public donor audit against 105a3d9; current apps/web now has all cited route families, live payment Worker and bundled hero. Preserve dated audit if desired; never treat its missing-route/payment assertions as current live state.

Ahead 2; behind 1797; 1 file changed, 133 insertions(+). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `docs/migration/DONOR_JOURNEY_AUDIT_20261101.md`

## origin/audit/supabase-reconciliation-20261101

**superseded_runtime_historical_evidence**. Standalone get-campaign-draft/list-connections/auth handlers duplicate owner-scoped worker/reads.js and accountRoutes.js now routed by worker/index.js; do not introduce competing APIs. Aggregate reconciliation SQL/evidence may be retained as dated documentation, but requires fresh catalog verification. public_campaign_detail invoker RPC is already recorded as hosted dependency.

Ahead 11; behind 1793; 10 files changed, 319 insertions(+). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `docs/migration/SUPABASE_LIVE_RECONCILIATION_20261101.md`, `docs/migration/sql/campaign_reconciliation_readonly.sql`, `docs/migration/sql/public_campaign_detail_invoker_read.sql`, `docs/migration/sql/public_campaign_detail_updated_at_column_grant.sql`, `functions/_lib/auth.js`, `functions/api/geocode-city.js`, `functions/api/get-campaign-draft.js`, `functions/api/list-connections.js`, `tests/get-campaign-draft.test.js`, `tests/list-connections.test.js`

## origin/chore/codespace-platform-diagnostics-20261101

**already_identical**. tools/platform_check.py blob exactly equals main.

Ahead 1; behind 1793; 1 file changed, 123 insertions(+). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `tools/platform_check.py`

## origin/implementation/secure-foundation-20261101

**historical_stack_do_not_merge_blindly**. Large alternative stack adds D1 workflow audit and extra canonical frontend guards/components, now forbidden by single-Supabase contract. Current apps/web MemberAccess, native workflows, Story/team workspaces supersede old implementations. Many missing tools/tests/migrations are not byte-for-byte present: retain historical source in Git; no safe inference that every old feature is live.

Ahead 469; behind 1808; 205 files changed, 27418 insertions(+), 396 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `.github/workflows/ifund-campaign-draft-security.yml`, `.github/workflows/ifund-migration-tests.yml`, `.github/workflows/migration-phase1-checks.yml`, `README.md`, `apps/web/DEPLOYMENT-GATES.md`, `apps/web/README.md`, `apps/web/package-lock.json`, `apps/web/package.json`, `apps/web/src/App.jsx`, `apps/web/src/api/auth.js`, `apps/web/src/api/publicData.js`, `apps/web/src/components/AuthLayout.jsx`, `apps/web/src/components/Layout.jsx`, `apps/web/src/components/RequireAccess.jsx`, `apps/web/src/components/TermsAcceptance.jsx`, `apps/web/src/components/campaigns/CampaignCard.jsx` (remaining paths in JSON)

## origin/migration/apk-parity-story-editor-20261103

**superseded_runtime**. Changes retired root src/pages/CampaignEditor.jsx; current canonical apps/web wizard has per-section regeneration and publication-quality review. Root tests cannot establish canonical acceptance.

Ahead 9; behind 1725; 4 files changed, 127 insertions(+), 18 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `src/App.jsx`, `src/pages/CampaignEditor.jsx`, `tests/campaign-section-priority.test.js`, `tests/campaign-story-paragraphs.test.js`

## origin/migration/audit-draft-validation-no-build

**superseded_runtime**. Introduces separate campaign-paypal Edge checkout/donation schema now replaced by workers/ifund-payments plus ifund-payment-ledger and verified live capture SQL. Do not merge parallel donation authority or old raw totals. Main auth/profile/publicData substantially evolved.

Ahead 74; behind 1811; 14 files changed, 373 insertions(+), 108 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `apps/web/src/api/campaignDonations.js`, `apps/web/src/api/publicData.js`, `apps/web/src/components/campaigns/CampaignCard.jsx`, `apps/web/src/components/campaigns/CampaignFundingCard.jsx`, `apps/web/src/pages/CampaignDetail.jsx`, `apps/web/src/pages/CreateCampaign.jsx`, `apps/web/src/pages/Dashboard.jsx`, `apps/web/src/pages/Discover.jsx`, `apps/web/src/pages/Profile.jsx`, `apps/web/src/pages/ResetPassword.jsx`, `docs/migration/ORIGINAL_PRODUCT_PARITY.md`, `docs/migration/PAYMENT_ARCHITECTURE.md`, `supabase/functions/campaign-paypal/index.ts`, `supabase/migrations/20261029000000_campaign_donations.sql`

## origin/migration/auth-password-recovery

**superseded_runtime_historical_tools**. Root auth flows replaced by apps/web AuthPage/ResetPassword/AuthCallback and owner navigation tests. Snapshot-transfer verifier/tools unique; optional historical utilities only, not permission to promote unverified snapshots.

Ahead 19; behind 1865; 15 files changed, 1096 insertions(+), 46 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `.gitignore`, `docs/migration/BLOCKERS.md`, `docs/migration/CACHED_SNAPSHOT_TRANSFER_20261025.md`, `docs/migration/INVENTORY.md`, `docs/migration/STATUS.md`, `scripts/migration/snapshot-transfer.mjs`, `scripts/migration/verify-owner-rls.sql`, `src/App.jsx`, `src/lib/authFlows.js`, `src/pages/Auth.jsx`, `src/pages/ForgotPassword.jsx`, `src/pages/ResetPassword.jsx`, `src/styles.css`, `tests/auth-flows.test.js`, `tests/snapshot-transfer.test.js`

## origin/migration/base44-decoupling-audit

**historical_evidence_tools**. 1152-line source traversal audit and snapshot-transfer tooling are absent main, so evidence is genuinely unique. Root API adapter superseded by canonical apps/web transport; audit must retain historical date and cannot establish live 184-entrypoint parity.

Ahead 60; behind 1865; 13 files changed, 1849 insertions(+), 2 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `.env.example`, `.gitignore`, `docs/migration/BASE44_DECOUPLING_AUDIT.md`, `docs/migration/BLOCKERS.md`, `docs/migration/CACHED_SNAPSHOT_TRANSFER_20261025.md`, `docs/migration/INVENTORY.md`, `docs/migration/STATUS.md`, `scripts/migration/snapshot-transfer.mjs`, `scripts/migration/verify-owner-rls.sql`, `src/lib/api.js`, `src/lib/supabase.js`, `tests/api-client.test.js`, `tests/snapshot-transfer.test.js`

## origin/migration/base44-exit-supabase-cloudflare-wix

**obsolete_destructive**. 635-file deletion branch would remove LICENSE, current AGENTS, architectural evidence. Its broad cleanup is stale; never apply tree wholesale. Retired Convex/Base44 already absent current main.

Ahead 2; behind 1966; 635 files changed, 2466 insertions(+), 379365 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `.agents/.memory/IDENTITY.md`, `.agents/.memory/SOUL.md`, `.agents/.memory/USER.md`, `.agents/.memory/conversations/README.md`, `.agents/.memory/memory.md`, `.agents/BOOTSTRAP.md`, `.agents/mcps/config.json`, `.agents/platform-docs/.docs-version`, `.agents/platform-docs/README.md`, `.agents/platform-docs/agent-api.md`, `.agents/platform-docs/agent-webhooks.md`, `.agents/platform-docs/automations.md`, `.agents/platform-docs/backend-functions.md`, `.agents/platform-docs/base44-apps.md`, `.agents/platform-docs/browser.md`, `.agents/platform-docs/capabilities.md` (remaining paths in JSON)

## origin/migration/base44-frontend-parity-20261103

**historical_release_tooling**. Contains source-drift/preview evidence contracts and cyclic-chunk guard absent main. Its deploy workflows are obsolete vs current controlled release. Keep helper evidence optionally, but do not restore old workflow triggers or infer from helper absence a present chunk-cycle defect.

Ahead 109; behind 1725; 61 files changed, 2108 insertions(+), 17 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `.github/workflows/audit-canonical-frontend.yml`, `.github/workflows/deploy-web-pages.yml`, `.github/workflows/ifund-lead-release-evidence-tests.yml`, `.github/workflows/original-frontend-preview.yml`, `apps/web/public/_redirects`, `apps/web/tests/deployment-readiness.test.js`, `build/guard-cyclic-chunks.js`, `docs/architecture/IFUND_CLOUDFLARE_AGENT_WORKER_CONSOLIDATION_20261109.md`, `docs/architecture/IFUND_CONNECTION_DISCOVERY_AGENT_CONTRACT_20261109.md`, `docs/architecture/IFUND_PLANNING_COMPOSITE_DEPLOYMENT_20261109.md`, `docs/architecture/IFUND_PREVIEW_PARITY_EXECUTION_PLAN_20261109.md`, `docs/architecture/tools/verify-agent-release-evidence.mjs`, `docs/architecture/tools/verify-agent-release-evidence.test.mjs`, `docs/migration/FRONTEND_FIRST_RELEASE_CONTRACT_20261105.md`, `docs/migration/ISSUE_203_BRANCH_BOUNDARIES_AND_RELEASE_EVIDENCE.md`, `docs/migration/ISSUE_203_CANONICAL_SOURCE_DRIFT_GATE_20261109.md` (remaining paths in JSON)

## origin/migration/blog-replica-20261030

**already_present_evolved**. Three blog pages and two blog SQL migrations identical blobs on main; current blog library/tests and workflow evolved. Old CSS/App route additions superseded.

Ahead 25; behind 1808; 11 files changed, 439 insertions(+). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `.github/workflows/reporter-blog-checks.yml`, `docs/migration/REPORTER_BLOG.md`, `src/App.jsx`, `src/lib/blogs.js`, `src/pages/BlogArticle.jsx`, `src/pages/Blogs.jsx`, `src/pages/MyBlog.jsx`, `src/styles.css`, `supabase/migrations/20261030175218_ifund_blog_migration_foundation_20261030.sql`, `supabase/migrations/20261030175806_ifund_blog_rls_and_index_hardening_20261030.sql`, `tests/reporter-blog.test.js`

## origin/migration/build-completeness-gates-20261029

**historical_stack_do_not_merge_blindly**. Alternative 243-file stack expands secure-foundation with devices/automations, D1 audit, offline proof ledgers. Main has later canonical equivalents for major routes; workflow and schema surfaces conflict with newer one-store contract. Missing historic tests/tools not evidence of live parity.

Ahead 479; behind 1808; 243 files changed, 31635 insertions(+), 400 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `.github/workflows/ifund-migration-tests.yml`, `.github/workflows/migration-phase1-checks.yml`, `README.md`, `apps/web/DEPLOYMENT-GATES.md`, `apps/web/README.md`, `apps/web/package-lock.json`, `apps/web/package.json`, `apps/web/src/App.jsx`, `apps/web/src/api/auth.js`, `apps/web/src/api/publicData.js`, `apps/web/src/components/AuthLayout.jsx`, `apps/web/src/components/Layout.jsx`, `apps/web/src/components/RequireAccess.jsx`, `apps/web/src/components/TermsAcceptance.jsx`, `apps/web/src/components/campaigns/CampaignCard.jsx`, `apps/web/src/components/campaigns/CampaignEmbeddedText.jsx` (remaining paths in JSON)

## origin/migration/geocode-city

**historical_adapter_requires_reconciliation**. Adds a separate authenticated geocode Worker and source fixture verifier; not current canonical route. Main canonical city behavior must be checked via apps/web location flow, not reintroducing stale private standalone Worker bindings. Also modifies old AGENTS/policy docs; preserve current instructions.

Ahead 4; behind 1865; 29 files changed, 31073 insertions(+), 6 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `.gitignore`, `.kiro/agents/ifund-engineer.json`, `.kiro/steering/engineering-policies.md`, `.kiro/steering/tech.md`, `AGENTS.md`, `docs/kiro/global-policies.template.md`, `docs/migration/BLOCKERS.md`, `docs/migration/CACHED_SNAPSHOT_TRANSFER_20261025.md`, `docs/migration/GEOCODE_CITY.md`, `docs/migration/INVENTORY.md`, `docs/migration/STATUS.md`, `docs/migration/contracts/automations.json`, `docs/migration/contracts/entities.json`, `docs/migration/contracts/functions.json`, `docs/migration/contracts/geocode-deployment.json`, `docs/migration/contracts/site-observations.json` (remaining paths in JSON)

## origin/migration/nonbuild-inbox-20261030

**historical_stack_do_not_merge_blindly**. 185-file secure-foundation ancestor, old notification worker/D1 audit and snapshot migration stack. Current inbox/team APIs differ; do not restore D1 or broaden grants.

Ahead 413; behind 1808; 185 files changed, 26339 insertions(+), 386 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `.github/workflows/ifund-migration-tests.yml`, `.github/workflows/migration-phase1-checks.yml`, `README.md`, `apps/web/DEPLOYMENT-GATES.md`, `apps/web/README.md`, `apps/web/package-lock.json`, `apps/web/package.json`, `apps/web/src/App.jsx`, `apps/web/src/api/auth.js`, `apps/web/src/api/publicData.js`, `apps/web/src/components/AuthLayout.jsx`, `apps/web/src/components/Layout.jsx`, `apps/web/src/components/RequireAccess.jsx`, `apps/web/src/components/TermsAcceptance.jsx`, `apps/web/src/components/campaigns/CampaignCard.jsx`, `apps/web/src/components/campaigns/CampaignEmbeddedText.jsx` (remaining paths in JSON)

## origin/migration/payments-platform-support

**superseded_runtime**. Old root support UI and Worker paypalWebhook queue; replaced by canonical Support, PayPal platform-support merchant receipts and workers/ifund-payments. Pending phase2/secret schemas must not be blindly applied.

Ahead 25; behind 1892; 26 files changed, 3607 insertions(+), 42 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `.github/workflows/migration-phase1-checks.yml`, `docs/migration/BLOCKERS.md`, `docs/migration/CAMPAIGN_PERSISTENCE_ACCEPTANCE.md`, `docs/migration/CAMPAIGN_RUNTIME_SCHEMA_REVIEW.sql`, `docs/migration/INVENTORY.md`, `docs/migration/PAYMENTS_PLATFORM_SUPPORT.md`, `docs/migration/STATUS.md`, `src/App.jsx`, `src/components/payments/PayPalDonateButton.jsx`, `src/lib/paypalLink.js`, `src/pages/Community.jsx`, `src/pages/Support.jsx`, `supabase/migrations/pending/20261025_independent_agent_conversations.sql`, `supabase/migrations/pending/payments_platform_support_001.sql`, `supabase/migrations/pending/phase2_ifund_finance_001_012.sql`, `supabase/migrations/pending/phase2_ifund_secrets_001_004.sql` (remaining paths in JSON)

## origin/migration/paypal-business-all-flows-20261026

**superseded_runtime**. Staged paypalBusiness/inbox/routing uses separate old webhook architecture. Current payment Worker, Edge ledger, provider capture/refund/payout SQL are authoritative. Provider acceptance still required; no automatic enablement.

Ahead 47; behind 1892; 36 files changed, 4320 insertions(+), 42 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `.github/workflows/migration-phase1-checks.yml`, `.gitignore`, `docs/migration/BLOCKERS.md`, `docs/migration/CAMPAIGN_PERSISTENCE_ACCEPTANCE.md`, `docs/migration/CAMPAIGN_RUNTIME_SCHEMA_REVIEW.sql`, `docs/migration/INVENTORY.md`, `docs/migration/PAYMENTS_PLATFORM_SUPPORT.md`, `docs/migration/PAYPAL_BUSINESS_ALL_FLOWS.md`, `docs/migration/STATUS.md`, `src/App.jsx`, `src/components/payments/PayPalDonateButton.jsx`, `src/lib/paypalLink.js`, `src/pages/Community.jsx`, `src/pages/Support.jsx`, `supabase/migrations/pending/20261025_independent_agent_conversations.sql`, `supabase/migrations/pending/payments_platform_support_001.sql` (remaining paths in JSON)

## origin/migration/phase2-campaign-runtime-review

**historical_schema_review**. Pending staging/finance/secrets typed contracts and campaign persistence review. Later main includes canonical operational schema plus base44 entity pending tables. Some historical private DDL absent; reconcile actual hosted catalog, never append all SQL.

Ahead 13; behind 1892; 17 files changed, 2909 insertions(+), 41 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `.github/workflows/migration-phase1-checks.yml`, `docs/migration/BLOCKERS.md`, `docs/migration/CAMPAIGN_PERSISTENCE_ACCEPTANCE.md`, `docs/migration/CAMPAIGN_RUNTIME_SCHEMA_REVIEW.sql`, `docs/migration/INVENTORY.md`, `docs/migration/STATUS.md`, `src/pages/Community.jsx`, `supabase/migrations/pending/20261025_independent_agent_conversations.sql`, `supabase/migrations/pending/phase2_ifund_finance_001_012.sql`, `supabase/migrations/pending/phase2_ifund_secrets_001_004.sql`, `supabase/migrations/pending/phase2_ifund_stage_001_018.sql`, `supabase/migrations/pending/phase2_ifund_stage_019_036.sql`, `supabase/migrations/pending/phase2_ifund_stage_037_054.sql`, `supabase/migrations/pending/phase2_ifund_stage_055_072.sql`, `supabase/migrations/pending/phase2_ifund_stage_073_079.sql`, `supabase/migrations/pending/phase2_reviewed_legacy_foreign_keys.sql` (remaining paths in JSON)

## origin/migration/phase2-entity-schema

**historical_schema_review**. Typed phase2 staging/finance/secrets proposal absent main, deliberately private deny-by-default. New current base44 preservation contract governs it; no browser grants or financial promotion implied.

Ahead 10; behind 1892; 15 files changed, 2790 insertions(+), 41 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `.github/workflows/migration-phase1-checks.yml`, `docs/migration/BLOCKERS.md`, `docs/migration/INVENTORY.md`, `docs/migration/STATUS.md`, `src/pages/Community.jsx`, `supabase/migrations/pending/20261025_independent_agent_conversations.sql`, `supabase/migrations/pending/phase2_ifund_finance_001_012.sql`, `supabase/migrations/pending/phase2_ifund_secrets_001_004.sql`, `supabase/migrations/pending/phase2_ifund_stage_001_018.sql`, `supabase/migrations/pending/phase2_ifund_stage_019_036.sql`, `supabase/migrations/pending/phase2_ifund_stage_037_054.sql`, `supabase/migrations/pending/phase2_ifund_stage_055_072.sql`, `supabase/migrations/pending/phase2_ifund_stage_073_079.sql`, `supabase/migrations/pending/phase2_reviewed_legacy_foreign_keys.sql`, `tests/phase2-schema.test.js`

## origin/migration/phase2-runtime-bootstrap-20261025

**historical_import_tools**. Private shadow/snapshot SQL and transfer workflow uniquely absent current tree; these are historical preservation utilities, not production publication. Source/owner counts and hashes require fresh reconciliation before migration replay.

Ahead 63; behind 1892; 43 files changed, 6565 insertions(+), 45 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `.github/workflows/ifund-private-supabase-transfer.yml`, `.github/workflows/migration-phase1-checks.yml`, `docs/migration/BLOCKERS.md`, `docs/migration/CONNECTED_RUNTIME_AUDIT_20261025.md`, `docs/migration/DNS_LIVE_PREFLIGHT_2026-10-25.md`, `docs/migration/FRONTEND_PAGE_STATUS.json`, `docs/migration/FUNCTION_PORT_STATUS.json`, `docs/migration/INVENTORY.md`, `docs/migration/PHASE7_CUTOVER_RUNBOOK.md`, `docs/migration/STATUS.md`, `docs/migration/TABLE_POPULATION_STATUS_20261025.md`, `docs/migration/export-manifest-template.json`, `scripts/cutover-readiness.mjs`, `scripts/migration/media-audit.mjs`, `scripts/migration/transfer_supabase_snapshots.py`, `scripts/migration/verify-export.mjs` (remaining paths in JSON)

## origin/migration/phase3-auth-owner-link

**historical_schema_review**. Proposal owner-link RPC/rules never substitutes for current verified owner mapping. Do not infer authority from source email or staged auth UID. Retain historical ownership evidence; canonical main account checks now evolved.

Ahead 20; behind 1892; 20 files changed, 3053 insertions(+), 42 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `.github/workflows/migration-phase1-checks.yml`, `docs/migration/BLOCKERS.md`, `docs/migration/INVENTORY.md`, `docs/migration/OAUTH_SETUP.md`, `docs/migration/STATUS.md`, `src/lib/supabase.js`, `src/pages/Community.jsx`, `supabase/migrations/pending/20261025_independent_agent_conversations.sql`, `supabase/migrations/pending/phase2_ifund_finance_001_012.sql`, `supabase/migrations/pending/phase2_ifund_secrets_001_004.sql`, `supabase/migrations/pending/phase2_ifund_stage_001_018.sql`, `supabase/migrations/pending/phase2_ifund_stage_019_036.sql`, `supabase/migrations/pending/phase2_ifund_stage_037_054.sql`, `supabase/migrations/pending/phase2_ifund_stage_055_072.sql`, `supabase/migrations/pending/phase2_ifund_stage_073_079.sql`, `supabase/migrations/pending/phase2_reviewed_legacy_foreign_keys.sql` (remaining paths in JSON)

## origin/migration/phase4-agent-workflow-reconnect-20261026

**obsolete_store_architecture**. Adds Durable/D1 automation workflow engine and audit. Single-Supabase durable-record rule rejects D1 queue/audit as canonical. Current workforce services/gateway and Supabase workflow contracts own runtime.

Ahead 21; behind 1865; 35 files changed, 2685 insertions(+), 2 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `d1/migrations/0001_ifund_workflow_audit.sql`, `docs/migration/AGENT_WORKFLOW_RECONNECTION.md`, `docs/migration/BLOCKERS.md`, `docs/migration/CLOUDFLARE_RUNTIME_COMPLETION.md`, `docs/migration/INDEPENDENT_API_ROUTE_MATRIX.md`, `docs/migration/INVENTORY.md`, `docs/migration/PHASE4_RESOURCE_BLOCKERS.md`, `docs/migration/STATUS.md`, `docs/migration/sql/ifund_publish_protocol_review.sql`, `scripts/verify-worker-cutover.mjs`, `src/App.jsx`, `src/pages/Automations.jsx`, `tests/phase4-admin-integration-health.test.js`, `tests/phase4-automation-readiness.test.js`, `tests/phase4-automations-admin-ui.test.js`, `tests/phase4-campaign-api.test.js` (remaining paths in JSON)

## origin/migration/phase4-gated-api-clean

**already_present_evolved**. INDEPENDENT_API_ROUTE_MATRIX, account/body/community test files and bodyLimit/communityWrites blobs identical main. Current worker/index and reads/campaignWrites expanded. Preserve evolved behavior.

Ahead 1; behind 1868; 12 files changed, 1223 insertions(+), 1 deletion(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `docs/migration/INDEPENDENT_API_ROUTE_MATRIX.md`, `tests/phase4-account-api.test.js`, `tests/phase4-body-limit.test.js`, `tests/phase4-campaign-api.test.js`, `tests/phase4-community-writes.test.js`, `tests/phase4-reads.test.js`, `worker/accountRoutes.js`, `worker/bodyLimit.js`, `worker/campaignWrites.js`, `worker/communityWrites.js`, `worker/index.js`, `worker/reads.js`

## origin/migration/phase4-worker-function-ports

**already_present_plus_historical_schema**. Core gated API files largely identical/evolved on main; stacked pending phase2/3 proposals not safe to apply. 184-entrypoint status manifest historical, not proof each port complete.

Ahead 50; behind 1892; 31 files changed, 5573 insertions(+), 44 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `.github/workflows/migration-phase1-checks.yml`, `docs/migration/BLOCKERS.md`, `docs/migration/FUNCTION_PORT_STATUS.json`, `docs/migration/INDEPENDENT_API_ROUTE_MATRIX.md`, `docs/migration/INVENTORY.md`, `docs/migration/STATUS.md`, `src/pages/Community.jsx`, `supabase/migrations/pending/20261025_independent_agent_conversations.sql`, `supabase/migrations/pending/phase2_ifund_finance_001_012.sql`, `supabase/migrations/pending/phase2_ifund_secrets_001_004.sql`, `supabase/migrations/pending/phase2_ifund_stage_001_018.sql`, `supabase/migrations/pending/phase2_ifund_stage_019_036.sql`, `supabase/migrations/pending/phase2_ifund_stage_037_054.sql`, `supabase/migrations/pending/phase2_ifund_stage_055_072.sql`, `supabase/migrations/pending/phase2_ifund_stage_073_079.sql`, `supabase/migrations/pending/phase2_reviewed_legacy_foreign_keys.sql` (remaining paths in JSON)

## origin/migration/phase5-all-page-routes-20261026

**superseded_frontend**. Restores alternate root shell and placeholders; canonical apps/web now owns routes and exact original artwork. Do not replace actual routed pages with root RestoredMember/Public placeholders.

Ahead 68; behind 1865; 50 files changed, 7032 insertions(+), 361 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `docs/migration/BLOCKERS.md`, `docs/migration/INVENTORY.md`, `docs/migration/ORIGINAL_APP_PARITY_RECOVERY.md`, `docs/migration/ORIGINAL_FULL_PARITY_GATE.md`, `docs/migration/PHASE5_ALL_PAGES.md`, `docs/migration/STATUS.md`, `docs/migration/role-platform-evidence.json`, `index.html`, `public/ifund-logo-small.webp`, `public/interplanetary-planet.svg`, `public/manifest.webmanifest`, `public/platform-logos/facebook.svg`, `public/platform-logos/gofundme.svg`, `public/platform-logos/instagram.svg`, `public/platform-logos/linkedin.svg`, `public/platform-logos/pinterest.svg` (remaining paths in JSON)

## origin/migration/phase5-frontend-parity

**already_present_plus_historical_schema**. Root campaign/community transports and both tests identical main. Old legal pages/evidence and stacked phase2/3 schemas superseded/review-gated.

Ahead 53; behind 1892; 34 files changed, 5616 insertions(+), 60 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `.env.example`, `.github/workflows/migration-phase1-checks.yml`, `docs/migration/BLOCKERS.md`, `docs/migration/FRONTEND_PAGE_STATUS.json`, `docs/migration/FUNCTION_PORT_STATUS.json`, `docs/migration/INVENTORY.md`, `docs/migration/STATUS.md`, `src/App.jsx`, `src/lib/campaignApi.js`, `src/lib/communityApi.js`, `src/lib/legalPolicy.js`, `src/pages/About.jsx`, `src/pages/CampaignEditor.jsx`, `src/pages/Community.jsx`, `src/pages/Privacy.jsx`, `src/pages/Terms.jsx` (remaining paths in JSON)

## origin/migration/phase5-gated-ui-clean

**already_present_evolved**. campaignApi/communityApi and both transport tests identical main; root editor/community changes evolved. No new canonical frontend work found.

Ahead 1; behind 1867; 7 files changed, 387 insertions(+), 19 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `.env.example`, `src/lib/campaignApi.js`, `src/lib/communityApi.js`, `src/pages/CampaignEditor.jsx`, `src/pages/Community.jsx`, `tests/phase5-campaign-transport.test.js`, `tests/phase5-community-api.test.js`

## origin/migration/phase5-original-shell-recovery-20261026

**superseded_frontend**. Root migration shell/navigation and historical legal pages replaced by canonical apps/web Layout/routes and revised legal acceptance.

Ahead 26; behind 1865; 14 files changed, 1362 insertions(+), 142 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `docs/migration/ORIGINAL_APP_PARITY_RECOVERY.md`, `docs/migration/STATUS.md`, `src/App.jsx`, `src/components/MigrationShell.jsx`, `src/lib/legalPolicy.js`, `src/lib/migrationNavigation.js`, `src/pages/About.jsx`, `src/pages/Discover.jsx`, `src/pages/Feed.jsx`, `src/pages/Privacy.jsx`, `src/pages/Terms.jsx`, `src/styles.css`, `tests/frontend-availability.test.js`, `tests/migration-navigation.test.js`

## origin/migration/phase6-export-verify

**unique_offline_migration_tools**. scripts/migration/verify-export.mjs and media-audit.mjs + tests and manifest uniquely absent main. They offer offline ID/count/checksum evidence only; no ongoing source sync, authenticated R2 byte read-back or verified financial promotion. Keep as optional tools with current storage contract reconciliation.

Ahead 41; behind 1892; 32 files changed, 5601 insertions(+), 45 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `.github/workflows/migration-phase1-checks.yml`, `docs/migration/BLOCKERS.md`, `docs/migration/FRONTEND_PAGE_STATUS.json`, `docs/migration/FUNCTION_PORT_STATUS.json`, `docs/migration/INVENTORY.md`, `docs/migration/STATUS.md`, `docs/migration/export-manifest-template.json`, `scripts/migration/media-audit.mjs`, `scripts/migration/verify-export.mjs`, `src/App.jsx`, `src/lib/legalPolicy.js`, `src/pages/About.jsx`, `src/pages/Community.jsx`, `src/pages/Privacy.jsx`, `src/pages/Terms.jsx`, `supabase/migrations/pending/20261025_independent_agent_conversations.sql` (remaining paths in JSON)

## origin/migration/phase6-recommendation-importer

**unique_offline_migration_tool**. Offline prepare-recommendations validator uniquely absent main; hardcodes historical 836 count, all fields preserved without secret filtering. Safe only on separately authorized complete exports in private directory; do not auto-run/import or treat historical count as current.

Ahead 2; behind 1965; 2 files changed, 59 insertions(+). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `docs/migration/RECOMMENDATIONS.md`, `scripts/migration/prepare-recommendations.mjs`

## origin/migration/phase7-offline-cutover-gate

**unique_historical_cutover_tooling**. cutover-readiness assessor and offline export/media verifiers absent main; acceptance uses supplied proof flags, not live checks. Can retain as dated evidence but cannot certify production release.

Ahead 48; behind 1892; 36 files changed, 5834 insertions(+), 45 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `.github/workflows/migration-phase1-checks.yml`, `docs/migration/BLOCKERS.md`, `docs/migration/DNS_LIVE_PREFLIGHT_2026-10-25.md`, `docs/migration/FRONTEND_PAGE_STATUS.json`, `docs/migration/FUNCTION_PORT_STATUS.json`, `docs/migration/INVENTORY.md`, `docs/migration/PHASE7_CUTOVER_RUNBOOK.md`, `docs/migration/STATUS.md`, `docs/migration/export-manifest-template.json`, `scripts/cutover-readiness.mjs`, `scripts/migration/media-audit.mjs`, `scripts/migration/verify-export.mjs`, `src/App.jsx`, `src/lib/legalPolicy.js`, `src/pages/About.jsx`, `src/pages/Community.jsx` (remaining paths in JSON)

## origin/migration/provider-oauth-foundation-20261109

**superseded_runtime**. Old root UI and 4-provider OAuth foundation superseded by current expanded worker/oauth.js with CORS origin checks, AES vault, refresh/lifecycle and canonical Connections. Older duplicate vault SQL filename must not reapply.

Ahead 67; behind 1865; 16 files changed, 2127 insertions(+), 17 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `.gitignore`, `docs/integrations/PROVIDER_OAUTH_FOUNDATION.md`, `docs/migration/BLOCKERS.md`, `docs/migration/CACHED_SNAPSHOT_TRANSFER_20261025.md`, `docs/migration/INVENTORY.md`, `docs/migration/STATUS.md`, `scripts/migration/snapshot-transfer.mjs`, `scripts/migration/verify-owner-rls.sql`, `src/lib/platforms.js`, `src/pages/Connections.jsx`, `supabase/migrations/20261109000100_provider_oauth_vault.sql`, `tests/provider-oauth.test.js`, `tests/snapshot-transfer.test.js`, `worker/accountRoutes.js`, `worker/index.js`, `worker/oauth.js`

## origin/migration/provider-oauth-preview-20261109

**already_present_evolved**. Vault migration 20261109131024 exactly identical main; OAuth runtime/UI expanded substantially. Old preview workflow/redirect deletion conflicts with current controlled pipeline. Real provider grants remain hosted-release gate.

Ahead 51; behind 1725; 21 files changed, 2577 insertions(+), 45 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `.github/workflows/deploy-web-pages.yml`, `.github/workflows/original-frontend-preview.yml`, `.github/workflows/provider-oauth-preview-checks.yml`, `apps/web/.env.example`, `apps/web/public/_redirects`, `apps/web/src/App.jsx`, `apps/web/src/pages/Connections.jsx`, `apps/web/src/pages/OAuthCallback.jsx`, `apps/web/tests/account-session-integrity.test.js`, `apps/web/tests/deployment-readiness.test.js`, `apps/web/tests/oauth-providers.test.js`, `docs/integrations/PROVIDER_OAUTH_FOUNDATION.md`, `scripts/verify-isolated-preview.mjs`, `supabase/migrations/20261109131024_ifund_provider_oauth_vault_20261109.sql`, `supabase/migrations/20261109140000_ifund_provider_oauth_expiry_audit.sql`, `tests/function-security.test.js` (remaining paths in JSON)

## origin/migration/public-site-port

**already_present_evolved**. verifiedCampaignProgress replaced by current verifiedFundingProgress/fundingTotals; Embed uses canonical API and no iframe payments. Profile now uses memberProfile guarded transport rather than old direct upsert. Reapplying old helper/UI would regress newer behavior.

Ahead 3; behind 1830; 11 files changed, 227 insertions(+), 23 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `apps/web/src/App.jsx`, `apps/web/src/api/publicData.js`, `apps/web/src/components/campaigns/CampaignCard.jsx`, `apps/web/src/components/campaigns/CampaignFundingCard.jsx`, `apps/web/src/lib/campaignProgress.js`, `apps/web/src/lib/profileInput.js`, `apps/web/src/pages/EmbedCampaign.jsx`, `apps/web/src/pages/Profile.jsx`, `apps/web/tests/campaign-progress.test.js`, `apps/web/tests/embed-safety.test.js`, `apps/web/tests/profile-input.test.js`

## origin/migration/single-supabase-workflow-foundation-20261027

**unique_schema_and_build_gate_requires_reconciliation**. One-project cohesion validator and private mail/workflow schema DDL absent main. Important historical hosted dependencies; current canonical worker targets must be inspected live. Do not blindly apply previously hosted DDL or revive prebuild gating without reconciling all deploy jobs.

Ahead 10; behind 1865; 6 files changed, 450 insertions(+), 1 deletion(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `docs/migration/SINGLE_SUPABASE_CONSOLIDATION.md`, `package.json`, `scripts/check-supabase-cohesion.mjs`, `supabase/migrations/20261027_single_project_mail_foundation.sql`, `supabase/migrations/20261027_single_project_workflow_foundation.sql`, `tests/supabase-cohesion.test.js`

## origin/migration/supabase-cloudflare

**unique_historical_snapshot_tools**. Offline snapshot-transfer SQL generator/verifier and owner RLS script uniquely absent main; no canonical runtime change. Preserve Git evidence; actual source reconciliation not proven.

Ahead 3; behind 1865; 8 files changed, 444 insertions(+). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `.gitignore`, `docs/migration/BLOCKERS.md`, `docs/migration/CACHED_SNAPSHOT_TRANSFER_20261025.md`, `docs/migration/INVENTORY.md`, `docs/migration/STATUS.md`, `scripts/migration/snapshot-transfer.mjs`, `scripts/migration/verify-owner-rls.sql`, `tests/snapshot-transfer.test.js`

## origin/migration/zip-source-intake-20261025

**historical_reference_only**. 1235 files under migration/reference and source-intake documents; Base44 ZIP reference intentionally read-only. Main inventories/provenance govern current source; do not revive Base44 runtime or copy credential patterns.

Ahead 6; behind 1965; 1235 files changed, 128425 insertions(+). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `docs/migration/ZIP_SOURCE_INTAKE.md`, `migration/reference/2026-10-25-base44-export/.agents/skills/chief_of_staff.md`, `migration/reference/2026-10-25-base44-export/.agents/skills/communications_agent.md`, `migration/reference/2026-10-25-base44-export/.agents/skills/finance_agent.md`, `migration/reference/2026-10-25-base44-export/.agents/skills/growth_agent.md`, `migration/reference/2026-10-25-base44-export/.agents/skills/ifund-admin-builder/SKILL.md`, `migration/reference/2026-10-25-base44-export/.agents/skills/ifund-chief-of-staff/SKILL.md`, `migration/reference/2026-10-25-base44-export/.agents/skills/ifund-chief-of-staff/references/agent-guide.md`, `migration/reference/2026-10-25-base44-export/.agents/skills/ifund-communications/SKILL.md`, `migration/reference/2026-10-25-base44-export/.agents/skills/ifund-communications/references/agent-guide.md`, `migration/reference/2026-10-25-base44-export/.agents/skills/ifund-content-writes/SKILL.md`, `migration/reference/2026-10-25-base44-export/.agents/skills/ifund-finance/SKILL.md`, `migration/reference/2026-10-25-base44-export/.agents/skills/ifund-finance/references/agent-guide.md`, `migration/reference/2026-10-25-base44-export/.agents/skills/ifund-growth/SKILL.md`, `migration/reference/2026-10-25-base44-export/.agents/skills/ifund-growth/references/agent-guide.md`, `migration/reference/2026-10-25-base44-export/.agents/skills/ifund-outreach/SKILL.md` (remaining paths in JSON)

## origin/preview/integration-batch-20261103

**superseded_frontend**. Adds old draft sections helper in 55-line wizard diff; canonical CreateCampaign now 1600+ lines with newer owner scoped drafts, Story service and context invalidation.

Ahead 2; behind 1726; 1 file changed, 55 insertions(+), 1 deletion(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `apps/web/src/pages/CreateCampaign.jsx`

## origin/preview/source-staged-20261113

**relevant_missing_repairs**. Exact-cent donation parser/max, Edge quote equality, webhook readiness, strict subscription identity/race fixes genuinely missing main. Assigned isolated repair branch. Atomic subscription SQL remains staged/unwired and requires catalog/provenance reconciliation and actual database concurrent-event tests; synthetic model tests alone do not prove production race safety.

Ahead 41; behind 809; 14 files changed, 670 insertions(+), 22 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `apps/web/src/components/payments/CampaignDonationDialog.jsx`, `apps/web/src/lib/donationAmount.mjs`, `apps/web/src/lib/paymentQuote.js`, `apps/web/tests/donation-amount.test.js`, `apps/web/tests/payment-quote.test.js`, `supabase/functions/ifund-payment-ledger/index.ts`, `supabase/migrations/20261114_ifund_subscription_atomic_events_staged.sql`, `supabase/tests/ifund_subscription_atomic_preflight_readonly_20261114.sql`, `supabase/tests/ifund_subscription_historical_provenance_readonly_20261114.sql`, `supabase/tests/payment-intent-quote-guard.test.mjs`, `supabase/tests/subscription-capture-replay-identity.test.mjs`, `supabase/tests/subscription-event-race.synthetic.test.mjs`, `supabase/tests/subscription-provider-events.synthetic.test.mjs`, `supabase/tests/subscription-readiness-guard.test.mjs`

## origin/qa/ai-staleness-test-contract-20261105

**superseded_frontend_tests**. Tests regexes against early small wizard. Current CreateCampaign uses buildRequestContext/session-owner guards, newer tests. Do not restore old wizard or deprecated release workflow; stale response cases still belong in current runtime acceptance.

Ahead 52; behind 1725; 11 files changed, 423 insertions(+), 36 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `.github/workflows/deploy-web-pages.yml`, `.github/workflows/original-frontend-preview.yml`, `apps/web/public/_redirects`, `apps/web/src/pages/CreateCampaign.jsx`, `apps/web/src/pages/Home.jsx`, `apps/web/tests/ai-suggestion-staleness.test.js`, `apps/web/tests/deployment-readiness.test.js`, `apps/web/tests/original-frontend-preview-contract.test.js`, `apps/web/tests/section-proposal-context-invalidation.test.js`, `apps/web/tests/section-regeneration-context.test.js`, `apps/web/tests/section-regeneration-stale-errors.test.js`

## origin/qa/section-regeneration-context-contract-20261108

**superseded_frontend_tests**. Early sectionRevision/storySectionsRef test contracts target retired implementation. Current canonical story workspace/wizard evolved. Old help fee wording must not overwrite current verified-ledger text.

Ahead 74; behind 1725; 18 files changed, 548 insertions(+), 43 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `.github/workflows/deploy-web-pages.yml`, `.github/workflows/original-frontend-preview.yml`, `apps/web/public/_redirects`, `apps/web/src/lib/helpArticles.js`, `apps/web/src/pages/CreateCampaign.jsx`, `apps/web/src/pages/Home.jsx`, `apps/web/tests/ai-suggestion-staleness.test.js`, `apps/web/tests/deployment-readiness.test.js`, `apps/web/tests/guest-draft-help-contract.test.js`, `apps/web/tests/original-frontend-preview-contract.test.js`, `apps/web/tests/section-proposal-context-invalidation.test.js`, `apps/web/tests/section-regeneration-context-unlock.test.js`, `apps/web/tests/section-regeneration-context.test.js`, `apps/web/tests/section-regeneration-edit-unlock.test.js`, `apps/web/tests/section-regeneration-full-story-unlock.test.js`, `apps/web/tests/section-regeneration-rejection-scope.test.js` (remaining paths in JSON)

## origin/repair/pre-migration-campaign-ux-20261029

**superseded_frontend_and_historical_tools**. Root auth/campaign/blog/help/agent restorations replaced by canonical apps/web. Offline export/cutover tools same historical phase6/7 proposals; preserve source not raw runtime. Pending secret/finance staging DDL needs catalog review, not direct merge/apply.

Ahead 123; behind 1892; 68 files changed, 9297 insertions(+), 468 deletions(-). Exact branch head and changed paths are recorded in branches.json.

Paths inspected: `.github/workflows/migration-phase1-checks.yml`, `docs/migration/BLOCKERS.md`, `docs/migration/DNS_LIVE_PREFLIGHT_2026-10-25.md`, `docs/migration/FRONTEND_PAGE_STATUS.json`, `docs/migration/FUNCTION_PORT_STATUS.json`, `docs/migration/INVENTORY.md`, `docs/migration/PHASE7_CUTOVER_RUNBOOK.md`, `docs/migration/STATUS.md`, `docs/migration/export-manifest-template.json`, `scripts/cutover-readiness.mjs`, `scripts/migration/media-audit.mjs`, `scripts/migration/verify-export.mjs`, `src/App.jsx`, `src/components/UI.jsx`, `src/lib/agentRoster.js`, `src/lib/campaignReview.js` (remaining paths in JSON)
