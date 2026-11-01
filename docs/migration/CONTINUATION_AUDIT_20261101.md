# IFund continuation audit — 2026-11-01

This document records read-only evidence gathered while continuing the eight migration workstreams. It supplements, and does not replace, issue #137 or the existing phase status. No production service, database rows, DNS, payment configuration, or deployment was changed during this audit.

## 1. Production source and deployment reconciliation

Cloudflare account plan is not changed by this audit. The Cloudflare Pages project `interplanetaryfund-migration` has custom domains `interplanetaryfund.com`, `www.interplanetaryfund.com`, and `preview.interplanetaryfund.com`. Its Git source metadata currently names `interplanetary-fund2`, production branch `main`, but its production deployment on 2026-10-31 uses commit `471bbe73b6ca6bf0c6173a85d655c9f6b35e4793`.

That commit is present in `interplanetarysister/InterplanetaryFund` and is not present in `interplanetarysister/interplanetary-fund2`. The Pages source metadata and actual deployed commit therefore do not agree. The deployment is from the migration repository's main branch, while the configured source metadata names the read-only Base44 source repository.

Both Pages projects have deployments disabled:
- `interplanetaryfund-migration`: production deployments disabled; preview deployments disabled.
- `interplanetaryfund-migration-preview`: source metadata points to `InterplanetaryFund`; deployments disabled.

No source connection, build configuration, deployment, alias, custom domain, route, or DNS setting was changed. Reconcile the Git source connection only after a reviewed release candidate exists and a rollback target is recorded.

The currently deployed migration app has a small route set (home, discover, campaign detail, create/edit, mine, login, connections, community, Reporter/blog routes). It is not the complete original application. The read-only source `interplanetary-fund2/main` still has the Base44 Auth/client bridge and Base44-dependent runtime. Do not deploy it as the independent destination without completing the adapter migration.

## 2. Campaign and community public-read repair

Read-only inspection of the live Supabase project `ssibsfmtodgximseeqsv` confirms the required public column grants already exist:
- Campaign public columns: `id,title,summary,story,category,goal_amount,cover_image_url,status,created_at`.
- Post public columns: `id,body,created_at`.

The existing RLS policies are appropriately restrictive:
- Anonymous campaign reads require `status = 'active'`.
- Authenticated campaign reads permit active campaigns, or owner/donor-visible rows subject to active-account checks.
- Community reads are public.
- Post insert/delete policies are restricted to the authenticated author and active account.

The application incorrectly queried `select("*")`, which also requests campaign `owner_id` / `updated_at` and post `author_id`. Those fields are not granted to anonymous readers (and post `author_id` is not granted to authenticated readers). This explains the PostgREST permission errors without requiring broader grants.

A code-only repair is prepared on branch `fix/public-column-projections-20261101`:
- Public campaign pages select only approved public campaign columns.
- Owner campaign pages use explicit projections and retain owner-scoped filters.
- Community pages select only `id,body,created_at`.
- The signed-in user's own post IDs are obtained through the existing `ifund_my_post_ids()` RPC; deletion remains protected by the existing author-only RLS policy.
- Added `tests/public-column-projections.test.js` to prevent regression.

The branch is seven commits ahead of `migration/supabase-cloudflare` and has no CI status yet. Local clone/build validation could not run because this execution environment could not resolve github.com. No PR was opened, no SQL grants were broadened, and no deployment was made. The repair is prepared but not yet merged, built, or runtime-verified.

## 3. SECURITY DEFINER function review

Two advisor warnings concern:
- `public.ifund_migration_my_campaigns()`
- `public.ifund_my_post_ids()`

Both functions are callable by `authenticated`, not `anon`. Their definitions use an empty search path and explicitly require a non-null `auth.uid()`; the campaign function additionally requires an active account, a verified owner mapping, a matching owner UUID, and non-financial source rows. The post-ID function returns only IDs authored by the current active account. These are intentionally scoped RPCs used for migration ownership and private UI controls. The warning merits security review, but revoking authenticated execution would break those intended flows. No function privileges or definitions were changed.

## 4. Route restoration and page parity

The original source App declares a broad public, protected, and admin route set. The current deployed migration App is a limited preview. The unmerged Phase 5 PR #142 reports a 57-page parity ledger: 3 static preview ports, 10 partial preview equivalents, and 44 not ported. About, Terms, and Privacy are included as copied historical content requiring owner/legal review. PR #142 is stacked on unmerged earlier phases and is not ready to merge wholesale.

No placeholder routes were added in place of real features, and no historical legal text was represented as newly approved policy. Full route parity remains incomplete.

## 5. Authentication and owner identity

Current live Supabase counts:
- Auth users: 3.
- Owner identity mappings: 3 `verified`, 7 `awaiting_destination_login`.

The existing passwordless UI offers Google, Facebook, and emailed one-time codes, but live provider credentials, redirect allowlists, email OTP template/delivery, and end-to-end provider callbacks have not been verified. No sign-in or OTP was initiated. The seven pending owner mappings remain unresolved; no campaign ownership was transferred.

## 6. Imported source data and reconciliation

Current live staged counts:
- `ifund_stage.campaign`: 28 records (18 active, 10 draft).
- `ifund_transfer.campaign_snapshots`: 28.
- Import batches remain `pending`: AgentActivity 397/397, AgentDelegation 26/26, Campaign 27/27, PlatformConnection 32/32.
- Total rows represented by those four pending import batches: 482 source rows and 482 imported rows.

The campaign stage/snapshot count (28) differs from the Campaign import batch source/import count (27). This discrepancy needs row-level source-ID and digest reconciliation before any campaign is promoted. Batch counts are not proof of complete source export or semantic parity. No rows were promoted, edited, deleted, or transferred.

Current public destination counts: 1 campaign, 1 post, 0 campaign donation rows, 0 payment event rows. The one public campaign is not proof of migrated campaign parity.

## 7. Payments and ledger

Open PR #145 is explicitly limited to PayPal donations to Interplanetary Fund itself. It does not implement campaign donations, subscriptions, the 3% withdrawal fee, optional 10% donor add-on, or withdrawals. Its proposed SQL is under `supabase/migrations/pending/` and is not applied. The PayPal webhook is not registered, `PAYPAL_WEBHOOK_ID` is not configured, no Worker secret has been set, and the provider sandbox behavior for hosted payment links remains unverified.

The PR has an unresolved review finding in refund/reversal matching: refund events must be matched to the original capture ID rather than rejected based on the refund's own `custom_id`. It is stacked on earlier unmerged phases and should not be merged or deployed until that finding and all dependencies are resolved.

No real payment or financial transaction was attempted. The user's standing choice is PayPal for IFund live payments; Stripe is not part of the authorized live payment plan. Campaign payment processing remains unavailable.

## 8. Integrations, workflows, and agents

Read-only Cloudflare inventory:
- `ifund-workflows`: no cron schedules, no bindings, no secrets.
- `ifund-workforce`: no cron schedules, no bindings, no secrets.
- `ifund-oauth`: D1 binding and plain-text feature/config flags, no secret bindings and no cron schedules.
- `interplanetary-fund-api-migration`: preview flag only, no secret bindings.
- `interplanetary-fund2`: still has Base44-origin configuration and a Supabase publishable key binding; no secret bindings.

The Supabase project currently has three deployed Edge Functions, all for mail ingress/admin mailbox operations; no campaign payment function is deployed. The source inventory describes 10 agents, 17 workflows, and 11 connectors, but definitions are not operational parity. No active workflow cron triggers, verified agent runtime, OAuth handshakes, or external provider sync have been demonstrated.

No workflows were enabled, no cron triggers were created, and no integration credentials were changed.

## Cost and validation record

The Supabase organization reports the Free plan. No new Supabase project or branch was created. No paid infrastructure, subscription, trial, metered CI, or deployment was initiated. GitHub repository operations created a code-only repair branch; the repository is public. The configured migration PR workflow uses standard GitHub-hosted runners and runs npm install/test/build/format checks, but no PR workflow ran for this branch. The local network could not resolve github.com, so local `npm ci`, tests, and build were not performed.

No production runtime verification is claimed. All changes on `fix/public-column-projections-20261101` remain unmerged and undeployed.
