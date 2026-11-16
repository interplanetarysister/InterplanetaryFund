# Independent feature/fix branch review

Forty initial ahead branches reviewed, including three coverage-gap agent branches. Inspected actual merge-base source diffs and current canonical replacements. No remote or hosted mutation performed.

Source commits prepared: 972af17c (admin/financial input/body boundaries), 9dd6d8a0 (workflow circuit breaker), 44416360 (campaign writing stale responses).

Superseded means current source intentionally replaces old behavior; it does not mean old commits are ancestors of main. Missing-capability branches must not be declared complete merely by recording an ours merge.

## feat/unified-agent-runtime-memory

**Disposition:** retired

Only adds public Convex agentBridge recordInteraction and agentIdentity registry. Convex is retired; bridge trusts client userId/approved and mutates global agent memory without owner checks. Do not restore. Current account-scoped Worker teamContext is the supported replacement.

Initial ahead/behind: 2/2187.

## feat/unified-agent-runtime-memory-v2

**Disposition:** retired

Second unmerged version of the same retired Convex/Base44 global agent-memory bridge. Do not restore public unauthenticated memory mutations; preserve current Worker teamContext.

Initial ahead/behind: 2/2187.

## feature/apimatic-api-contracts

**Disposition:** missing_optional_source

Four missing files: optional APIMatic plan, narrow PayPal GET Orders OpenAPI, injected-fetch read-only adapter and tests. No application caller or runtime dependency exists. Source can be retained as optional tooling after focused 3 tests, but it establishes no APIMatic usage or payment acceptance.

Initial ahead/behind: 4/1721.

## feature/base44-campaign-wizard-parity-20261110

**Disposition:** missing_capability

Missing R2 campaignMedia upload/serve handlers and campaignSetup persistence SQL/API/tests. Main CreateCampaign supports existing writing directions and owner guards, but lacks branch four-stage setup, saved wizard_step, preferred tone/never-change, story_versions. Main has a different campaign cover upload. Cannot call this branch integrated or production ready without porting remaining wizard/state behavior into canonical model and reconciling hosted SQL/R2 ownership.

Initial ahead/behind: 42/1662.

## feature/base44-ui-parity-navigation-audit

**Disposition:** superseded_legacy_frontend

Changes historical root src navigation/auth/discovery and adds root preview workspaces. Canonical apps/web has current routes, shell and workspaces. Restoring root parallel frontend conflicts with AGENTS. Missing original atlas pending migration cannot be applied blindly against current Supabase.

Initial ahead/behind: 84/1793.

## feature/campaign-starting-choices-20261103

**Disposition:** superseded

campaignWritingPaths helper and test are exact blobs on main; current CreateCampaign renders CAMPAIGN_WRITING_PATHS and guidedCampaignDetails with five directions. Keep current owner/privacy guards and newer editor.

Initial ahead/behind: 6/1725.

## feature/communications-agent-20261104

**Disposition:** missing_capability

Original Communications drafts/owner approval/guarded delivery Worker, SQL contracts, preference component and agent tests are absent from main, alongside inherited Growth/Strategy implementations. Current CommunicationsWorkspace provides owner-scoped draft tools and current serviceGateway routes only Story plus document erasure, not the old Communications service. Do not claim complete equivalent agent execution; reconcile adapters/consent/SQL before porting.

Initial ahead/behind: 6/1721.

## feature/growth-agent-20261104

**Disposition:** missing_capability

Growth reports and bulk recommendation review Worker/SQL/tests absent from main. Current AgentsTeam includes Growth role but generic workspace and catalog are not the original report execution contract; gateway lacks Growth routes. Requires deliberate port, catalog reconciliation and runtime acceptance.

Initial ahead/behind: 3/1721.

## feature/ifund-campaign-donation-ux-20261103

**Disposition:** superseded_with_architecture_exclusions

Large 582-commit historical accumulation mixes old root routes, superseded SQL snapshots, D1 workflow audit and notifications engine with canonical donation UI. Current CampaignFundingCard, PayPal checkout Worker, verifiedMoney and receipt finance pages supersede core donation UI. Do not restore old D1 durable app records or blindly replay 70+ SQL migrations. Full parity of removed original notification/automation functions remains unverified.

Initial ahead/behind: 582/1808.

## feature/ifund-studio-foundation-20261103

**Disposition:** superseded_with_missing_tooling

worker/studioRoutes and studio SQL exist but newer main differs; main has canonical AdminStudio and StudioPublishedPage. Branch root frontend mount should not replace canonical App. Missing snapshot-transfer helper/SQL/test are migration tooling, not proof of applied snapshots; retain only after catalog/data audit if still needed.

Initial ahead/behind: 85/1865.

## feature/judge-payment-environment-chooser-20261110

**Disposition:** superseded_docs_only

Two changed demo payment chooser files exactly match main; only historical docs/hackathon/JUDGE_PAYMENT_ENVIRONMENTS_20261110.md is absent. Current chooser implementation exists. No reason to roll back demo.

Initial ahead/behind: 3/1607.

## feature/managed-connections-agent-20261105

**Disposition:** missing_capability

Original Managed Connection help/delegation request tracking Worker, 43-provider catalog/logos, SQL contracts and registry are absent from main. Current Connections provides 46 provider destinations/public links/OAuth readiness and sharing preferences. Those supersede asset/navigation presentation but do not provide original managed bulk request/delegation execution. Original branch itself claims no live provider adapters/account creation; runtime/provider acceptance still blocked.

Initial ahead/behind: 162/1692.

## feature/my-giving-sandbox-icons-20261110

**Disposition:** superseded

MyGiving.jsx is absent intentionally; current /giving redirects /finances#giving-receipts. FinanceDashboard has owner-scoped provider-verified receipts, refunded status and safe cents. Original separate page defaults sandbox with unavailable history and lacks refund accounting. Keep consolidated finances.

Initial ahead/behind: 3/1657.

## feature/orbit-shorts-20261105

**Disposition:** missing_capability

Actual public /shorts swipeable video page and videoLinks parser are missing; current App has no /shorts route and SocialFeedPage does not import video parser. Do not mark integrated. Branch also includes stale editor and Story AI flags; port video feature in isolation with verified public projections/content safeguards.

Initial ahead/behind: 23/1691.

## feature/paypal-hackathon-sandbox-compliance-20261109

**Disposition:** superseded

Sandbox handler, compliance demo and AGPL license already present on main (five exact blobs; remaining source newer). Main preserves sandbox host restrictions, session binding, provider-verification checks and separate finance tables. Never enable live money through this branch. Browser/provider acceptance not repeated in this review.

Initial ahead/behind: 48/1667.

## feature/paypal-sandbox-secure-bindings-20261110

**Disposition:** superseded

Main sandbox handler already has explicit 403 checkout-session denial, 409 buyer approval requirement, signed ignored-event acknowledgement and readiness diagnostics; current HackathonDemo includes separate Personal buyer/Business merchant guidance. Missing branch-only automatic smoke workflow targets obsolete preview hostname; do not restore.

Initial ahead/behind: 15/1627.

## feature/route-completion-20261113

**Disposition:** integrate_with_repairs

15 unique commits at initial scan fix stale test paths/assertions, web deletion return context, admin clear-state and test-summary wrapper. Found incomplete async session race and existing malformed JSX close; fixed in 972af17c. Full wrapper review: preserves child failure/signal/spawn-error status and bounded diagnostics; no silent skip detected. Current complete-web failures limited known independently fixed share harness/payout assertion. Branch was independently merged remotely during review; reconcile latest origin/main.

Initial ahead/behind: 15/0.

## feature/strategy-agent-20261104

**Disposition:** missing_capability

Original Strategy Mission Control bulk recommendation decisions Worker/SQL/tests are absent. Current CampaignStrategy has free source-derived owner campaign content checks and budget planner; it truthfully says no new AI inference/grant submissions. That is a narrower supported replacement, not the original bulk decision persistence/runtime contract.

Initial ahead/behind: 2/1721.

## feature/verified-finance-views-20261109

**Disposition:** superseded

Current FinanceDashboard/AdminFinance and verified totals RPC references implement owner/donor/admin finance views with newer safe integer and refund handling. Branch old FinanceDashboard uses Number coercion and sum fallback to zero; do not overwrite current checked arithmetic.

Initial ahead/behind: 8/1664.

## fix/account-session-integrity-20261029

**Disposition:** superseded

Branch fixes Dashboard signOut error handling and distinguishes unverified connected rows. Current Dashboard checks signOut error and Connections verifies stored connections/provider readiness, with expanded account-session tests. Keep current canonical behavior.

Initial ahead/behind: 3/1809.

## fix/auth-recovery-redirects-20261103

**Disposition:** superseded

Main AuthPage, AuthCallback and ResetPassword contain expanded PKCE/token-hash recovery, explicit return routing and source tests. Branch older implementation allows any current session to reset after exchange; current session-flow protections must prevail.

Initial ahead/behind: 2/1725.

## fix/campaign-builder-parity

**Disposition:** missing_capability

Original four-step browser-persisted wizard not mounted by current single-page CreateCampaign. Some writing directions and owner-state safety superseded, but actual step UX, keyboard focus and saved wizard progression remain absent. Coordinate with newer base44-campaign-wizard branch before one canonical port; do not overlay both.

Initial ahead/behind: 1/1681.

## fix/campaign-detail-terminal-states-20261102

**Disposition:** superseded_with_tooling_exclusions

Current campaign detail uses terminal/error handling, public projections and safe lifecycle models. Older branch accumulation includes missing migration readiness scripts/contracts and snapshot bookkeeping; not all old tooling is integrated. No automatic replay of old snapshot/SQL/data scripts.

Initial ahead/behind: 20/1761.

## fix/guest-campaign-auth-recovery-20261103

**Disposition:** superseded

Current owner/guest scoped browser drafts, auth callback returnTo and recovery forms are newer; newer route-completion tests correct stale assertions around key composition and owner-specific clearing. Keep current session/consent protection.

Initial ahead/behind: 15/1725.

## fix/login-return-navigation-20261029

**Disposition:** superseded

safeReturnTo test exact on main; current AuthCallback/AuthPage use sanitized return routing with newer auth UX. Older two page blobs should not replace canonical forms.

Initial ahead/behind: 3/1810.

## fix/paypal-merchant-receipts-20261110

**Disposition:** superseded

Original member FinanceDashboard admin-receipt block replaced by dedicated AdminFinance calling verified admin receipts RPC. Existing main SQL refines platform-support/unattributed receipt handling. Do not add duplicate table migration without hosted catalog audit.

Initial ahead/behind: 3/1640.

## fix/public-column-projections-20261101

**Disposition:** superseded_legacy_frontend

Actual branch affects root src pages and two migration audit docs; five blobs exact on main, legacy root pages missing. Canonical apps/web public projections plus current Worker/RLS own privacy. Do not restore retired root feed/editor merely to preserve old public projection repair.

Initial ahead/behind: 9/1865.

## fix/reporter-public-read-20261031

**Disposition:** superseded

One exact retained SQL migration plus root src/pages/Blog.jsx public read changes. Current canonical Blogs/BlogArticle/PublicationArticle use safe published-only reads. No root parallel blog restore.

Initial ahead/behind: 1/1806.

## fix/sitewide-paypal-support-20261108

**Disposition:** superseded

Current App mounts shared PlatformSupportHostedButton and component uses hosted checkout. Branch old Home placement/SDK duplicate-init changes have newer canonical replacements. Preserve existing receipt classification and separated campaign checkout.

Initial ahead/behind: 6/1681.

## fix/source-backed-preview

**Disposition:** superseded_with_missing_assets

Old preview build scripts, assets and root-vs-app routing bootstrap differ from canonical controlled Pages pipeline. Many original files intentionally absent; no proof all source assets are preserved. Do not reinstate old Pages server bundle/build_preview.py/manual production snapshot as runtime; archive missing assets only if current reference parity needs them.

Initial ahead/behind: 3/1793.

## fix/studio-bodylimit-ci-20261105

**Disposition:** repair_carried

Confirmed current worker/bodyLimit misses safe integer cap validation and normalization/cancellation of malformed request streams. Carried branch runtime patch + 15 streaming regression files into 972af17c. Fixed original legacy test fixture (valid/malformed finite streams never closed, causing hang). 61 body tests pass. Obsolete branch-specific backend QA workflow was not restored.

Initial ahead/behind: 24/1725.

## fix/verified-funding-totals-20261029

**Disposition:** superseded

Two changed blobs exact main; current CampaignDetail consumes verified totals and separates sandbox/owner-reported values. Keep newer canonical implementation.

Initial ahead/behind: 3/1811.

## fix/zero-base44-tool-credit-evidence

**Disposition:** partially_superseded_missing_agents

Historical evidence/managed agent accumulation overlaps old Growth/Strategy/Communications/Managed branches, whose runtime files are absent current main. Current source avoids old paid tool dependencies; missing worker execution contracts cannot be called complete. Do not use historical green agent claims as live provider acceptance.

Initial ahead/behind: 9/1692.

## hackathon/admin-demo-toggle-20261111

**Disposition:** superseded_demo_artifact

Branch repairs a historically truncated generated demo/worker/app.js and adds optional showcase Worker with simulated metrics. Current demo has authored TypeScript/index build pipeline and mode controls. Generated app.js must be rebuilt from current source; never merge stale bundle/showcase simulation into canonical production.

Initial ahead/behind: 3/1596.

## ops/pause-workflows-after-three-failures

**Disposition:** repaired_source

Original privileged workflow listener repaired in 9dd6d8a0: explicit current workflow-name filter, correct workflow_run.workflow_id payload, default-branch trusted immutable source only, own-repository and same-branch metadata scope, newest sorted runs including incomplete jobs that prevent pausing, controller excluded, validated numeric recovery. No triggering branch execution or artifact parsing. Ten fixture tests PASS. No workflow enable/disable or runner invocation performed. Runtime disposable-workflow acceptance NOT TESTED; new listener becomes active for future events after merge.

Initial ahead/behind: 1/1440.

## release/provider-oauth-pages-20261109

**Disposition:** superseded

Current worker/oauth.js contains extended encrypted vault/refresh/revoke/lifecycle handling; provider vault exists under 20261109131024 name, plus expiry audit/identity expansion migrations. Current Connections has exact readiness gates and OAuthCallback. Branch missing old-name migration is not proof missing table; do not duplicate SQL or deploy old preview-worker workflow.

Initial ahead/behind: 15/1670.

## test/demo-frontend-100-payment-cases-20261113

**Disposition:** repair_carried

Confirmed missing duplicate/missing merchant PayPal ID detection and strict Google Pay decimal parser. Carried runtime fixes with 11 merchant tests and 122 actual Google Pay parser tests into 972af17c. Included parser tests in demo test:ledger; web test uses .test.js discovery. Other two old fixture-matrix files not carried: tests exercise conceptual handlers rather than additional production runtime; no refund/payment enablement performed.

Initial ahead/behind: 12/970.

## agent/backend-migration

**Disposition:** repaired_source

Branch sandbox handler/security and cookie-binding migration already exist as newer main equivalents; current sandboxSecurity adds stricter readiness/host validation compared to old branch. Missing bodyLimit cap/error normalization and 15 streaming tests carried in 972af17c; 61 body tests PASS. Old automatic backend QA workflow not restored. No hosted sandbox/provider/database changes.

Initial ahead/behind: 45/1725.

## agent/frontend-parity

**Disposition:** repaired_source

Found real missing stale writing-result protections, stored-story section hydration/visibility and section edit persistence in current canonical CreateCampaign. Ported protections to current owner-scoped editor in 44416360 with request generation guard. Seven behavioral tests execute actual asynchronous source request functions using deferred promises, including stale failure/finally races. Web production build PASS; full suite 707 cases 702 PASS/5 known concurrent-parent-owned failures only. Main hero is preserved independently; old external Base44 media URL not restored. Old help copy superseded by canonical guest/owner guidance and 7-percent fee.

Initial ahead/behind: 82/1725.

## agent/live-charge-verification-20261112

**Disposition:** unsafe_unintegrated

Actual branch only changes live payment Worker to append /live-charge-test hardcoded return/cancel URLs and provider approval_url. App defines no matching /live-charge-test route. Host allowlist does not reject embedded URL credentials; paths/query not checked and order binding occurs after requiring approval link. Must not activate arbitrary live-charge test or replace canonical checkout with this branch; no actual payment authorization or acceptance exists. Root owns final retirement/replacement decision.

Initial ahead/behind: 1/1408.

## Verification

- Canonical apps/web production build: PASS.
- Deferred administrative identity, merchant reconciliation and actual Google Pay parser: 138 PASS.
- Existing demo ledger/wallet suite plus parser: 150 PASS.
- Streaming body suite plus existing phase4 limits: 61 PASS.
- Circuit-breaker metadata/API fixtures: 10 PASS.
- Actual campaign writing async request functions, deferred success/failure/new-request races: 7 PASS.
- Complete web suite at isolated route base: 707 tests, 702 PASS and 5 FAIL (four pre-existing share SSR harness cases and one old payout recovery source assertion; parent owns and concurrently fixed these).
- Hosted browser/provider/RLS/SQL/deployment acceptance: NOT TESTED here.
