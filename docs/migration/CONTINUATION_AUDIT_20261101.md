# IFund continuation audit — 2026-11-01

This audit supplements issue #137. It records read-only evidence and a code-only hotfix prepared from the current production application branch. No production database rows, policies, grants, provider settings, DNS, Worker routes, Pages settings, or deployments were changed.

## Source and release reconciliation

The current Cloudflare Pages project `interplanetaryfund-migration` has custom domains for `interplanetaryfund.com`, `www`, and `preview`. Its source metadata says `interplanetary-fund2/main`, but its 2026-10-31 production deployment commit `471bbe73b6ca6bf0c6173a85d655c9f6b35e4793` exists in `InterplanetaryFund/main` and is not present in `interplanetary-fund2`. Thus the configured Git source metadata and actual deployed commit lineage disagree.

Both Pages projects have production and preview deployments disabled. The domain-serving project has a last known successful deployment but no new builds are enabled. No source connection, build setting, deployment, alias, custom domain, route, or DNS setting was changed.

The migration integration branch `migration/supabase-cloudflare` is 60 commits behind `InterplanetaryFund/main` and has no commits ahead of main. The public hotfix therefore has been prepared on a branch derived directly from current `main`, not on the stale integration branch. The integration-branch repair was also retained separately for review.

The currently deployed app is a reduced Supabase preview. Its route set is substantially smaller than the original Base44 application. The read-only `interplanetary-fund2/main` still contains the Base44 client/auth bridge and cannot be deployed as an independent Supabase replacement without completing the migration.

## Campaign and community permission defect

Live Supabase column privilege checks confirm that anonymous readers already have SELECT on the approved public campaign fields `id,title,summary,story,category,goal_amount,cover_image_url,status,created_at` and public post fields `id,body,created_at`. The RLS policies are already restrictive:
- Anonymous campaign reads require active status.
- Authenticated campaign reads are limited to active, owner-visible, or donor-visible rows under active-account checks.
- Community reads are public.
- Post insert/delete policies are author-scoped and require an active account.

The UI's `select("*")` requests restricted fields too: campaign `owner_id` and `updated_at`, plus post `author_id`. Those fields are not granted to anonymous readers; post `author_id` is not granted to authenticated readers. This is the direct cause of the permission errors.

A code-only hotfix is prepared on `fix/public-column-projections-main-20261101`:
- Public campaign queries select only approved public columns.
- Owner campaign queries use explicit fields and retain owner-scoped filters.
- Public community queries select only `id,body,created_at`.
- Community ownership controls use the existing authenticated `ifund_my_post_ids()` RPC, which returns only the current active account's own post IDs; deletion continues to be enforced by the author-only RLS policy.
- Added regression tests for the projection and ownership behavior.

The same targeted repair exists on `fix/public-column-projections-20261101`, derived from the older integration branch. The current-main branch is the relevant hotfix candidate. It is unmerged, has no CI status, and is not deployed. Local clone/build validation could not run because this environment could not resolve github.com. No live grants were broadened.

## Elevated function review

Two Supabase advisor warnings concern `ifund_migration_my_campaigns()` and `ifund_my_post_ids()`. Both are executable by authenticated users but not anon. Their definitions use an empty search path and require a valid `auth.uid()`; the campaign function also requires active account status, a verified owner mapping, and a non-financial source row. The post function returns only IDs authored by the current active account. These are deliberately scoped RPCs. Blanket revocation would break the migration/ownership UI; no privilege changes were made.

## Route and feature parity

The original source App contains public, authenticated, and admin route groups. The deployed migration App has only a small preview route set. Open Phase 5 PR #142 records a 57-page parity inventory: 3 static preview ports, 10 partial equivalents, and 44 not ported. Its About, Terms, and Privacy pages contain historical copy requiring owner/legal review and are stacked on earlier unmerged phase PRs. No placeholder routes or unreviewed legal text were added.

## Authentication and ownership

Live destination Supabase counts:
- Auth users: 3.
- Owner mappings: 3 verified, 7 awaiting destination login.

The preview UI offers Google, Facebook, and emailed one-time codes. Provider credentials, redirect allowlists, OTP template/delivery, and end-to-end sign-in remain unverified. No OTP or OAuth attempt was made. No campaign ownership was transferred.

## Source-data reconciliation

Live staged counts:
- 28 campaign rows and 28 distinct legacy IDs in `ifund_stage.campaign`.
- 28 campaign snapshots.
- Campaign import batch: 27 source rows / 27 imported rows, still pending.
- Other pending import batches: AgentActivity 397/397, AgentDelegation 26/26, PlatformConnection 32/32.
- All four import batches have null source digests and remain pending.
- Staged campaign statuses: 18 active, 10 draft.
- Public `ifund_campaigns`: 1 draft only; no active public campaign.
- Public community posts: 1.
- Campaign donation records: 0; payment event records: 0.

The staged campaign count (28) differs from the campaign import batch count (27), with no source digest available. No promotion or reconciliation write was attempted. The 28 staged campaigns are not approved for publication solely by their staged active status.

## Payments

Open PR #145 covers PayPal donations to IFund operations only. It does not implement campaign donations, subscriptions, the 3% withdrawal fee, the optional 10% donor add-on, or withdrawals. Its migration SQL is pending and unapplied; PayPal webhook registration, webhook ID, secret bindings, sandbox capture/refund behavior, and ledger reconciliation remain unverified. The PR has a review finding on refund/reversal matching: match the refund to the original capture ID, not the refund's own custom_id. The PR is stacked on unmerged earlier phases and must not be treated as production payment support.

No real payment or financial transaction was attempted. PayPal remains the authorized live provider; Stripe is not part of the live payment plan.

## Integrations, workflows, and agents

Cloudflare read-only inventory:
- `ifund-workflows`: no cron schedules, bindings, or secrets.
- `ifund-workforce`: no cron schedules, bindings, or secrets.
- `ifund-oauth`: D1 plus two plain-text settings, no secret bindings, no cron schedules.
- `interplanetary-fund-api-migration`: preview flag only, no secret bindings.
- `interplanetary-fund2`: Base44-origin configuration remains; it has a Supabase publishable key binding but no secret bindings.

Supabase currently has three deployed Edge Functions, all for mail ingress/admin mailbox work. No campaign payment Edge Function is deployed. The `ifund_ops.workflow_jobs`, `workflow_control`, and `workflow_execution_log` tables each returned zero rows. The source inventory's 10 agent definitions, 17 workflow definitions, and 11 connectors do not establish operational runtime parity.

No cron triggers, workflow controls, jobs, agent data, OAuth handshakes, or provider syncs were activated.

## Cost and verification

The Supabase organization reports the Free plan. No new project or branch was created in Supabase. No paid infrastructure, subscription, trial, metered CI, or deployment was initiated. The GitHub repository is public and the code-only branch was created using repository operations. No PR workflow ran for the hotfix branch, and local `npm ci`, tests, and build were not performed because github.com could not be resolved from this execution environment.

No production runtime verification is claimed. The main-based hotfix remains unmerged and undeployed.
