# Interplanetary Fund — workspace/canonical/runtime synchronization evidence (2026-11-22)

## Purpose and preservation

This record preserves the state of the 2026-11-22 synchronization without destructive Git operations, bulk route approval, or publication. No `reset --hard`, `clean -fd`, force-push, or duplicate-file removal was used.

- Recovery branch: `recovery/sync-20261122-041658`.
- Recovery branch base: `2bd3ff53897c59e16164babf5f7280904646ef4e` (`integration/stitch-design-prep-20261120`).
- Pre-change backup: `C:\Users\TopTier\AppData\Local\Temp\opencode\ifund-sync-backup-20261122-041658` (tracked patch, untracked manifest, runbook copy).
- QA authorization/runbook commit: `aa71b3964417eec88cc44c108dd0e21b51e0d850`.
- Local `main` before integration: `c990b73f697314a2bb5809e3c5f3ff22619f09bd`.
- `origin/main` after `git fetch --all --prune`: `01435ff046ba51f06e4fb9c439025d1d3eb8db61`.
- Recovery branch integration commit: `c88ce19018b54920a00b1d1a8179f2a7c15c059e`.

## Git and PR topology

- Local `main` was 101 commits behind `origin/main` and 0 commits ahead, so a fast-forward integration was safe.
- `origin/main` contained the weekly-training runtime source that was absent from the older checkout. The source was restored by merging `origin/main` into the recovery branch, not by recreating or overwriting files.
- Only five paths overlapped between the recovery side and `origin/main`: `AgentSidePanel.jsx`, `CreateCampaign.jsx`, `function-security.test.js`, `ifund-agent-team-questions.test.js`, and `worker/agents/teamQuestion.js`. Four merged automatically. The test-file conflict was resolved by keeping both the receipt-language test and the approved-skill prompt test.
- Strategic duplicate files were not deleted, moved, or merged. `tests/skill-placement-contract.test.mjs` still enforces the distinct builder and website-agent SKILL.md locations.
- Eight open PRs were found and deliberately left open as unfinished/unaccepted work: #362, #361, #350, #304, #301, #300, #299, #297.
- Local integration/backup branches were preserved. Their remote tracking states were not rewritten.
- `gh` is authenticated as `interplanetarysister` with repo/workflow scopes. Branch protection is disabled. All repository workflows use `workflow_dispatch`; a source push does not start CI or deployment jobs.

## Defect repaired before verification

The merge introduced weekly-training mutating `SECURITY DEFINER` functions that were not on the explicit review allowlist. Source inspection showed:

- start/claim/finish and agent-claim functions revoke `public,anon,authenticated` and grant only `service_role`;
- skill-candidate review requires `auth.uid()` plus `ifund_current_user_is_verified_super_admin()` and an independent passing evaluation;
- weekly-report and cross-agent routing helpers are trigger-only with no browser EXECUTE grant.

Actions taken:

1. Added narrowly scoped entries to `tests/function-security.test.js` with the grant-boundary rationale.
2. Added `tests/weekly-training-function-boundaries.test.mjs` to lock those grant boundaries in source.
3. Re-ran focused tests before broader checks.

No release or security check was weakened.

## Weekly agent-training reconciliation

The current tree now contains the weekly training Edge Function, research Worker, migrations, runtime documentation, versioned skills, super-admin review, evidence quarantine, and approved-skill retrieval source from `origin/main`.

Public read-only runtime check of `https://ifund-training-research.interplanetary-fund.workers.dev/results?week_key=2026-11-22&agent_id=<id>` returned complete receipts for all nine identities:

| Agent | State | Sources | Candidates | Evaluated | Approved |
|---|---|---:|---:|---|---|
| nexus | complete | 3 | 2 | false | false |
| story | complete | 3 | 2 | false | false |
| orbit | complete | 3 | 2 | false | false |
| polaris | complete | 3 | 2 | false | false |
| forge | complete | 3 | 2 | false | false |
| echo | complete | 2 | 2 | false | false |
| pulse | complete | 3 | 2 | false | false |
| link | complete | 3 | 2 | false | false |
| discover | complete | 3 | 2 | false | false |

These are public research-worker receipts only. They do **not** prove Supabase ingestion, independent evaluation, skill approval, live gateway retrieval, installed specialist improvement, paid research, browser automation, or a full weekly training cycle. No candidate was approved.

## Local verification

All commands ran locally; no GitHub Actions run was dispatched and no Cloudflare or Supabase write was attempted.

| Check | Result |
|---|---|
| Focused team-question regression | pass |
| Focused function-security regression | pass |
| New weekly-training boundary regression | pass |
| Root `npm test` | 1048/1048 pass |
| Canonical web `npm test` | 1153/1153 pass (243 test files) |
| Browser policy suite | 3/3 pass |
| Release-scope suite | 23/23 pass |
| Root `npm run build` | success |
| Canonical web `npm run build` | success (warning only: large FinanceDataGrid chunk) |
| Route readiness gate | exit 1, fail-closed; 89 routes still `not_verified` |
| Dependency audit | exit 1; `npm audit could not complete` for all three projects |

Canonical web build assets: `assets/index-D_jLqvSm.js`, `assets/index-CB7xWWc9.css`, shared `react-runtime-B4xiu1gp.js` and `supabase-_Ts6dIFp.js`. The live website still serves `assets/index-gDIH1HHC.js` with the same main CSS hash `index-CB7xWWc9.css`; therefore the current source build is not the deployed bundle. No publication was performed.

## Credentials and acceptance blockers

- `SUPABASE_SERVICE_ROLE_KEY` is absent from the process and from Windows user-scope environment.
- `SUPABASE_PROJECT_REF`, `IFUND_QA_PROVISION_APPROVED`, and `CLOUDFLARE_API_TOKEN` are absent from the current shell environment. The owner's QA provisioning decision remains recorded in the runbook, but the approval flag must be supplied inline when the credential exists.
- Wrangler reports `You are not authenticated.`
- Live Supabase applied migrations, function definitions, RLS/grants, cron rows, and admin/QA identities remain unverified.
- Live Cloudflare Worker versions, bindings, secrets, and deployment SHA remain unverified beyond the public research-results endpoint.
- Authenticated member, owner, non-owner, admin, and super-admin browser acceptance remains **BLOCKED / UNVERIFIED**.
- No preview or production promotion is legitimate while the route gate and role acceptance remain incomplete.

## Next steps

1. Commit and safely integrate this evidence; push `main` only as a fast-forward source synchronization.
2. Supply an authorized Supabase server/admin credential to a restarted shell, read live verifier definitions, then provision the five approved QA identities and immediately verify authoritative admin mapping.
3. Run the role-specific browser matrix and cross-account negative cases; record redacted receipts.
4. Complete route evidence before any release gate can pass. Do not bulk-approve the 89 rows.
5. Provide a Cloudflare API token only when a controlled preview is authorized; build and seal one immutable artifact, publish, verify, and only then consider a separately authorized promotion.

## Addendum — post-push branch and PR audit

A read-only topology audit after the fast-forward push confirmed local `main`, `origin/main`, and the recovery branch are identical at `2f376abd933efb61a8a752b4d0f81b6765d5d035` (`left-right 0 0`). No further `main` synchronization is currently needed.

- The Stitch/recovery commits `2bd3ff53…`, `1b12ef79…`, `aa71b396…`, `c88ce190…`, and `2f376abd…` entered `main` by the controlled fast-forward sequence during this synchronization. GitHub reports no PR association for them; this record preserves that fact rather than implying PR review.
- 278 remote branches were inventoried; 39 contain patch-unique work. None were deleted, rewritten, squash-merged, or inferred duplicate by name.
- Eight open PRs remain. #361 (`4732e354…`, Cloudflare observability) is the only clean, non-draft, no-overlap candidate, with two unique commits; it still requires configuration review and controlled preview evidence before integration. #362, #350, #297, and the drafts #299/#300/#301/#304 are dirty, heavily overlapping, or far behind, and remain unfinished.
- Closed-unmerged PR work with unique patches (#302, #298, #326, #339) remains preserved as evidence and is not reintroduced automatically.
- `origin/feat/cash-app-donation-privacy` (`c70d1183…`, 36 unique commits) is a hard policy blocker: it changes the first-party withdrawal fee to 3%, conflicting with current main and the standing 7% withdrawal rule. Do not integrate without a separate explicit owner pricing decision and payment acceptance.
- No duplicate-looking SKILL.md, configuration, generated file, backup, or historical document was deleted or consolidated. Distinct consumer verification remains mandatory.

## Addendum - reconciliation work session 2026-11-22 (source-only, no publication)

Branch `reconcile/agent1-frontend-20261122` (created from `origin/main` at `0f9a8061`) now carries four commits. No preview, production, Worker, SQL, R2, or provider change was triggered.

- `8f8bc9b7` - persisted the reconciliation checkpoint ledger (`docs/operations/FRONTEND_RECONCILIATION_CHECKPOINT_20261122.md`).
- `d07ac717` - PR #350 extraction, adapted to current main: owner frontend quality contract, `apps/web/src/styles/premium-surface.css` material guards (contrast/print/320px only - it deliberately does not reposition the verified Account + Ask IFund rail or redefine background geometry), AGENTS.md directive, and `apps/web/tests/premium-surface-layout.test.mjs` with four regression tests. Geometry precedence resolved in favor of the newer `styles-cosmic-refinement.css`, recorded as an open owner design decision in the contract note.
- `f8ff79bf` - PR #362 extraction: illustration style/caption persistence through `campaignSetupPayload`/`CampaignImageChoices`/`CreateCampaign` plus Save draft available on every creator step, with two new regression tests in `campaign-wizard-persistence.test.js`. Main's newer provenance-aware `onApply` was preserved.
- `0c50c169` - three repairs found by running the suites first (repair-before-check discipline): (1) `workers/ifund-payments/capture-refund-boundary.test.mjs` now splices the real `premiumOneTimeWebhook` so its non-live fail-closed gate is exercised instead of throwing `ReferenceError`; (2) `tests/stitch-design-reference-contract.test.mjs` normalizes CRLF so the LF-written contract enforces identically under `core.autocrlf=true` (pre-existing on origin/main); (3) `tests/function-security.test.js` explicitly reviewed and allowlisted the four mutating SECURITY DEFINER functions introduced by main's `b1ea6748` migrations (`ifund_ai_content_reserve/complete/status`, `ifund_subscription_runtime.sync_verified_premium_entitlement`), each with a written justification: auth.uid()-scoped, provider-verified entitlement, no financial or cross-user authority, EXECUTE revoked from public/anon/authenticated.

Verification actually run on this branch: targeted layout/cosmic/wizard batch 77/77 and 18/18; full web suite 1190/1190 pass; full root suite 1058/1058 pass (both exit 0). Route-readiness gate, authenticated role-matrix acceptance, and browser viewport acceptance remain BLOCKED/UNVERIFIED as recorded above; no credential was present and none was simulated.

## Addendum - final shared-branch + origin/main integration and test results (2026-11-23)

Branch `reconcile/agent1-frontend-20261122` tip `024d1fcb`; local `main` fast-forwarded by `--ff-only` merge with it. All reconciliation work is committed on the branch; nothing was force-pushed or rebased.

### Shared branch (agent-5) merge

- `dead5bc2 merge(agent-5): integrate shared integration branch 76 commits into reconcile (main-favoring conflicts resolved)`
- Conflicts resolved per matrix: `CampaignStrategy.jsx`, `Home.jsx`, `CreateCampaign.jsx` ? main; line-level merges for `CampaignDonationDialog.jsx` (main wording + sandbox-aware), `worker.js` (BASIC_MONTHLY_PLAN main side), `teamQuestion.js` (main approved-skills + branch history/practice), `campaignDocumentAvailability.mjs` (main comment); auto-merges audited: `campaign-wide-editorial-review.test.js` (both), `ifund-payment-ledger/index.ts` (main's strict \$4.99/admin guards).

### origin/main 2026-11-23 merge (5a88e690 + Premium direct-card checkout series)

- `2c32c853 chore(merge): integrate origin/main (Premium direct-card checkout) favoring newest main` (clean)
- Worker fixes: `exactBasicPlan(plan)` reverted to 1-param (new-main shape); `subscriptionReadiness`/`subscriptionPlans`/`startSubscription` aligned to new main (literal `BASIC_MONTHLY_PLAN.plan_id` P-8RG, no `IFUND_BASIC_MONTHLY_PAYPAL_PLAN_ID`); removed branch's Pages alias (`/api/payments/sandbox`) + cookie rewrite (new main = `/api/paypal/sandbox`); retargeted `CampaignDonationDialog.jsx` sandbox calls to `/api/paypal/sandbox/*`; `node --check workers/ifund-payments/worker.js` passes.
- New fix branches triaged: `fix/premium-direct-card-visibility-20261123` and `fix/recurring-card-checkout-truthful-gates-20261123` are BOTH ancestors of origin/main (contained; no unique commits, nothing to merge).
- Branch-native tests deleted (not in origin/main; their subjects are branch-only designs now superseded by newer main): `command-center-creator-separation.test.mjs`, `sandbox-alias-cookie-scope.test.mjs`, `dual-mode-gateway.test.mjs`, `subscription-five-dollar-safe-contract.test.mjs`, `r2-reviewed-inventory-negative-qa.test.mjs`, `qa-r2-reviewed-inventory-boundary.test.mjs`; `CampaignStrategy.jsx`/`CreateCampaign.jsx` checked out from origin/main; `worker/services/privateDocumentErasure.js` + `worker/index.js` checked out from origin/main.
- Session PR #362 features preserved: `campaignSetupPayload` `image_style`/`image_caption` (merged, new main-compatible) and `CampaignImageChoices` `initialStyle/initialCaption/onSettingsChange`; `apps/web/tests/campaign-wizard-persistence.test.js` Save-draft assertions adapted to the new-main three-page flow (Save draft on steps 0-1, final save/publish on step 2).

### Test results on the integrated state (2026-11-23)

- Root suite: `npm.cmd test` exit 0, failing tests 0 (prior intermediate failures repaired; rerun after each repair).
- Web suite: `npm.cmd test` (apps/web) exit 0.
- `node --check workers/ifund-payments/worker.js` exit 0.

### Constraints honored

- Private R2 document deletion remains fenced/disabled per origin/main's `privateDocumentErasure.js` (no frontend-only enable).
- No GitHub Actions, no preview/production publication, no new Cloudflare/Supabase/R2 changes.
- 7% withdrawal fee untouched.

### Still BLOCKED / UNVERIFIED (no credentials present)

- `CLOUDFLARE_API_TOKEN` absent (route gate, Wrangler, preview).
- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`, `IFUND_QA_PROVISION_APPROVED` absent (QA identities, authenticated role matrix).
- Authenticated browser acceptance, production deployment SHA verification, live provider verification: BLOCKED/UNVERIFIED.
- Six specialist subagent audits: no results produced (recorded in checkpoint).

## Addendum - push + final verification (2026-11-23)

### Push

- `git push origin main` exit 0: `6de92636..e8ac2bd0 main -> main` - origin/main now `e8ac2bd0`; local `main` == `origin/main` tip. Working tree clean. The two new fix branches were merged earlier as normal merges (`c7f60434` on main).

### Six removed regression tests - coverage verification (origin/main = new main, authoritative)

Verified via `git show origin/main:<file>` string checks:

- **command-center-creator-separation.test.mjs**: equivalents on origin/main - `step===2&&<div aria-label="Campaign launch review"` (FOUND), `Publishing requires a secure account with a verified owner ID` (FOUND), `save("active")` (FOUND), CampaignStrategy `ifund_owner_campaign_strategy_readiness` + `private campaign readiness could not be verified` (FOUND). New main redesigned the flow (no "Want to improve your campaign further" / "Guest drafts stay in this browser" strings - new main's guest flow uses its own `importGuestWizard` design) - no restoration needed; no valid newer implementation was reverted.
- **sandbox-alias-cookie-scope.test.mjs**: origin/main serves sandbox via the new Pages design (`apps/web/functions/api/paypal/sandbox/[[path]].js`, `worker/paypalSandboxSecurity.js` cookie `Path=/api/paypal/sandbox`) - equivalent/stronger coverage: `paypal-sandbox-compliance.test.js`, `paypal-sandbox-buyer-guidance.test.js`, `premium-direct-guest-card-acceptance.test.mjs` (admin/verified/owner).
- **dual-mode-gateway.test.mjs**: equivalents on origin/main: `premium-direct-guest-card-acceptance.test.mjs`, `atomic-paypal-edge-release.test.mjs` (verified).
- **subscription-five-dollar-safe-contract.test.mjs**: equivalents on origin/main: `subscription-live-availability.test.js` (verified), `subscription-live-contract.test.js` (499/verified/owner), `public-subscription-plans.test.js` (verified). New main worker: `amount_cents:499`, `verifyPremiumOneTimeCapture`, `payments/premium-one-time/readiness` FOUND; ledger `p.amount_cents!==499`, `p.currency!=="USD"`, `subscription_plan_readiness` FOUND.
- **r2-reviewed-inventory-negative-qa.test.mjs + qa-r2-reviewed-inventory-boundary.test.mjs**: equivalents on origin/main: `private-document-erasure.test.js` (reviewed/owner/does not belong/refused/ten/byte) + `campaign-media-r2.test.js` (R2/owner/receipt).

### Payment safety (origin/main, source-verified)

- 7% withdrawal fee untouched (no changes to payout code; `quote(gift,tip)` = gift+tip).
- Basic subscription $4.99: `BASIC_MONTHLY_PLAN = {tier:"basic",interval:"monthly",amount_cents:499,plan_id:"P-8RG59105D5288480MNMBOKJA"}` on origin/main worker; `product_id.length>=6` present.
- Ledger guards on origin/main: `p.amount_cents!==499` (Premium purchase request validation), `p.currency!=="USD"`, `subscription_plan_readiness`, super_admin guard `user.app_metadata?.role!=="super_admin"` throw "Verified super administrator required".
- Migrations on origin/main: `20261123000005_premium_owner_only_checkout_acceptance.sql` (admin/verified/grant/revoke), `20261123000006_premium_private_trial_allowlist.sql` (allowlist/service_role).
- Direct-card: new main's `premium-direct-guest-card-acceptance.test.mjs` + `atomic-paypal-edge-release.test.mjs` + `subscription-live-contract.test.js` (499/verified/owner) - fail-closed provider verification unchanged; no payment activated without provider verification (no live provider credentials present).

### R2 protections (origin/main, source-verified)

- `worker/services/privateDocumentErasure.js` == merged main version (identical); `worker/index.js` has NO privateDocumentErasure wiring (deletion not exposed); origin/main has no Agent-2 R2 adapter files (`r2ErasureAdapter` etc. absent).
- Deletion stays disabled/fenced pending Agent 2 backend concurrency protection - nothing was enabled; no frontend-only re-enable.
- Equivalent tests: `private-document-erasure.test.js` + `campaign-media-r2.test.js` on origin/main.

### Final verification (main, commit e8ac2bd0, exit codes)

- Root suite `npm test`: exit 0, failing tests 0 (rerun after the leftover-conflict fix; branch merge changes are web-only but root rerun confirms).
- Web suite (`apps/web npm test`): exit 0.
- Web build (`apps/web npm run build`): exit 0 (`vite build`: `built in 17.86s`; chunk-size warnings only).
- Route-readiness gate (`apps/web/ci/verify-route-readiness.mjs`): exit 1 - fail-closed by design (89 routes `not_verified`, e.g. /templates, /terms, /u/:id, /what-if, /withdrawals). Records that preview/production not compilable until routes finish.
- Fix found during final verification: leftover `<<<<<<< HEAD` conflict markers in `apps/web/src/components/payments/CampaignDonationDialog.jsx` (from the M2 merge) - resolved (commit e8ac2bd0).
- Push: main -> origin/main at e8ac2bd0; working tree clean.

### Blocked / UNVERIFIED (no credentials present)

- Browser acceptance (real user/member flows) - BLOCKED/UNVERIFIED: no `CLOUDFLARE_API_TOKEN` (Wrangler/preview impossible) and no authenticated-browser credentials. Not fabricated.
- Route verification (live-browser) - expected to stay fail-closed; route gate exit 1 recorded.

## Addendum - route audit + browser acceptance status (2026-11-23)

### Route audit (`apps/web/ci/verify-route-readiness.mjs`, main @ 2fc04455)

- Gate output (UTF-16LE, parsed): **89 routes missing source+test acceptance** and **36 routes missing backend authorization evidence** (overlapping set, not_verified by design). Sample of 89: `*`, `/`, `/about`, `/activate`, `/admin` (×7), `/agents`, `/ai-images`, `/analytics`, `/atlas`, `/auth/callback`, `/auth/mobile-callback`, `/blog`, `/blogs`, `/campaign/:id`, `/campaigns`, `/campaigns/:id/edit`, `/communications`, `/community`, `/connect`, `/connections`, `/contact`, `/create`, `/dashboard`, `/delete-account`, `/devices`, `/discover`, `/donors`, `/download`, `/embed/campaign/:id`, `/engagement`, `/finances`, `/following`, `/forgot-password`, `/founding-members`, `/fundraising-partners`, `/giving`, `/globe`, `/hackathon`, `/hackathon/tracker`, `/health-privacy`, `/help`, `/help/:slug`, `/inbox`, `/institutions`, `/institutions/:id`, `/ledger`, `/login`, `/mail`, `/messaging`, `/mission`, `/missions`, `/missions/:id`, `/my-blog`, `/my-profile`, `/news`, `/notifications`, `/oauth/callback/:provider`, `/onboarding`, `/ops`, `/our-story`, `/p/:slug`, `/permissions`, `/plans`, `/platform`, `/privacy`, `/profile`, `/publication`, `/publications/:id`, `/register`, `/reset-password`, `/social`, `/social/post/:id`, `/strategy`, `/subscriptions`, `/support`, `/templates`, `/terms`, `/u/:id`, `/what-if`, `/withdrawals`.
- Sample missing backend auth: `/admin`, `/admin/audit`, `/admin/deletions`, `/admin/finance`, `/admin/help`, `/admin/social-moderation`, `/admin/studio`, `/admin/sustainability`, `/ai-images`, `/analytics`, `/campaigns`, `/campaigns/:id/edit`, `/communications`, `/connections`, `/devices`, `/donors`, `/engagement`, `/finances`, `/following`, `/hackathon/tracker`, `/inbox`, `/mail`, `/messaging`, `/missions`, `/missions/:id`, `/my-blog`, `/notifications`, `/onboarding`, `/ops`, `/permissions`, `/platform`, `/profile`, `/publication`, `/strategy`, `/subscriptions`, `/support`.
- Spot-check of `apps/web/src/pages`: page files exist for many routes (e.g., `Terms`, `Dashboard`, `Home`, `CreateCampaign`, `Atlas`); the gate's dominant gap is missing acceptance evidence, not obviously missing page implementations. No functional defects were repaired in this audit (none identified before budget exhaustion; the gate's fail-closed posture is preserved — preview/production compile stays blocked until acceptance evidence lands).

### Browser acceptance (local, 320/390/desktop) — BLOCKED/UNVERIFIED

- No Playwright installed: no `playwright` binary in `apps/web/node_modules/.bin`, no `@playwright` package directory.
- `vite preview` on 127.0.0.1:4817 did not stay in a listening state when attempted in the background.
- No browser-automation credentials or runtime browser environment available. Local Playwright acceptance at 320/390/desktop was NOT run and NOT claimed.

### Premium subscription checkout flow — source-verified fail-closed (priorities 3+4)

- `PremiumOneTimeCheckout.jsx`: readiness gate requires `v.ready===true && v.auto_renews===false && v.amount_cents===499 && v.currency==="USD"` (non-renewing $4.99 only); `create-order` validates `response.amount_cents!==499 || response.currency!=="USD"` before continuing; backend `verifyPremiumOneTimeCapture` (origin/main worker) requires verified merchant, immutable order/capture match, merchant ID and amount before `signLedger("premium_one_time_finalize")`; entitlements granted via migration-gated admin-only acceptance (`20261123000005_premium_owner_only_checkout_acceptance.sql` — admin/verified/grant/revoke verified); direct-card/PayPal guest card cannot mint entitlement before verified provider capture + backend authorization (no live provider credentials present, not activated).

### Pushes this session

- `git push origin main` exit 0: `e8ac2bd0..2fc04455 main -> main`; origin/main = 2fc04455. Working tree clean.
