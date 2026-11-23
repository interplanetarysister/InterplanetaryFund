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
