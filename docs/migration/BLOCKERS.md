# Blockers and evidence — migration Phase 1
Updated: 2026-10-24. Authority: [issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137).
**Status vocabulary:** VERIFIED = observed in connected source; SUPPORTED = documented capability without IFund production trial; UNKNOWN = requires authorized runtime/provider verification. No production changes are authorized by this file.

## B1 — Can all Base44 records, including donations and financial ledgers, be exported?
**SUPPORTED API route / UNKNOWN completeness.** Base44 supports Data-dashboard per-entity CSV export and paginated SDK `entities.<Type>.list/filter` reads; [official SDK docs](https://docs.base44.com/sdk-getting-started/client) show `asServiceRole.entities.<Type>.list()` inside Base44-hosted functions, but not external service-role usage. Authorized Base44 owner could run an audited, read-only function that paginates **every** entity (including Donation, HoldingLedgerEntry, FinancialOperation, Withdrawal, WebhookEvent, payouts) to JSONL/JSON; dashboard CSV can be used as independent reconciliation. A management API/CLI alternative may be possible but has not been verified with app permissions. Respect pagination, rate limits, PII access and financial consistency.
**Test export:** NOT RUN/NOT VERIFIED by this migration effort. **Per-entity row counts:** UNKNOWN (none established). **Checksums:** UNKNOWN. No user data has been copied. No indication that a source-code ZIP includes database records. **Blocks:** production database import and cutover. **Next proof:** owner-authorized read-only 1-entity sample with count and hash, then all 95 entities plus financial provider ledger reconciliation and a no-write-delta cutover plan.

## B2 — Are passwords/OAuth links transferable? How will users sign in?
**UNKNOWN identity export.** `base44/entities/User.jsonc` describes application profile fields, not necessarily Base44 authentication password hashes or portable Google-provider links. There is no verified export of password hashes, provider subject IDs, or live sessions. Do **not** claim transferable passwords, hashes or OAuth grants based on a third-party article. Plan: export allowed User profile rows (including stable legacy ID/email with consent); provision/claim Supabase Auth accounts after independent email verification or fresh Google OAuth; password-based users use Supabase password reset or magic links. Map old identity IDs to new auth.users IDs with verified ownership, preserving associated campaign/donation records. No implicit admin role from email/metadata. **Blocks:** seamless account cutover and correct ownership reconciliation; does not block scaffold or schema.

## B3 — Where are uploaded images/files; bulk export?
**SUPPORTED hosted-URL storage / UNKNOWN bulk completeness.** Source `src/components/media/MediaUpload.jsx` calls `uploadUserImage(base44, file)`; media URLs are stored in entity rows. Some are Base44-hosted media URLs and may need authorization or expiring signed access. Public URL downloads can be scripted; private URLs must be handled with authorized sessions, not made public. No complete file/bytes inventory, bulk download, hashes or read-through test is verified. Plan enumerate **all** file-bearing fields and rich-content links, download bytes in a permitted authenticated batch, hash, upload to **private/public scoped Supabase Storage buckets** with RLS, update URLs after verification. **Blocks:** media parity and cutover.

## B4 — Which built-ins and what replacements?
**VERIFIED in source:** `@base44/sdk` entity CRUD and Auth; `integrations.Core.InvokeLLM`, `GenerateImage`, `SendEmail`; upload/image-watermark helper; `functions.invoke`; hosted agents, connectors, workflows. Source directory inventory on main: **95 entities, 184 function entrypoints, 11 connectors, 10 agents, 17 workflows, 1 mcp file**. These counts describe source definitions, not implemented ports. Replacement map:
- Entity CRUD, realtime, access rules → Supabase Postgres + RLS + Realtime where applicable; `ifund_ops` already exists privately.
- Auth → Supabase Auth; explicit role tables/authorization and migration proof.
- Uploads/image policies → Supabase Storage plus server-side watermark and controlled generation.
- InvokeLLM/GenerateImage → independently configured AI model/image provider called server-side through Cloudflare Worker/Supabase Edge Function; quotas and consent required.
- SendEmail → provider-backed transactional email integration with sending-domain verification; existing mail ingress is not assumed to provide outbound capability.
- Hosted functions, agent tools, webhooks, scheduled workflows → authenticated Worker/Edge Functions and private workflow queues, preserving idempotency, audit, provider scopes and permission checks.
- Connectors → provider-specific OAuth refresh/token storage in private secrets/vault; disabled until verified provider handshake.
**Blocks:** complete feature parity; does not block documentation or scaffold.

## B5 — Where are PayPal/Stripe webhooks and secrets?
**VERIFIED code destination, UNKNOWN provider state.** `interplanetary-fund2/base44/functions/setupPayPalSubscriptionWebhook/entry.ts` hard-codes `https://interplanetaryfund.base44.app/functions/payPalSubscriptionWebhook` and contains a provider registration/verification path; successful execution/remote registration was **not** checked. PayPal campaign callbacks may have separate paths. `base44/functions/stripeWebhook/entry.ts` reads `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` through `base44:runtime`; the Stripe dashboard's configured endpoint is **UNKNOWN**. Other PayPal credentials and OAuth provider grants may live exclusively as runtime/dashboard secrets; existence, values, scopes and rotation status were not inventoried. **Never export secret values to Git, logs or migration reports**. Owner must verify endpoint registrations in PayPal/Stripe dashboards, inventory names and supported rotation flows, provision fresh Cloudflare/Supabase secrets, validate signed sandbox webhooks and idempotent receipt settlement before production changes. **Blocks:** live financial operations, safe payouts, final cutover.

## B6 — What are source migration branches, and which Supabase migrations are actually applied?
**VERIFIED branch diffs:** [owner-proof-gate branch](https://github.com/interplanetarysister/interplanetary-fund2/tree/migration/owner-proof-gate-20261023) is a diverged working branch with owner identity/consent gates, guarded campaign previews and shadow reconciliation tools (85 commits ahead, 16 behind main at inspection). Do not merge blindly or assume main contains its latest work. [private-agent-conversation-store branch](https://github.com/interplanetarysister/interplanetary-fund2/tree/migration/private-agent-conversation-store-20261022) adds `docs/migration/independent-agent-conversations.sql` as its lone branch-diff file (1 commit ahead, 36 behind main); this is a proposal, **not evidence of applied SQL**.

**VERIFIED via Supabase project `tzehxfikoslihnclhxuz` list_migrations:** 25 recorded applied migrations, in order:
1. `20261019143600_create_isolated_business_mail_foundation`
2. `20261019145629_business_mail_secure_ingress_and_private_text`
3. `20261019145646_member_mail_backend_rpc_for_trusted_edge`
4. `20261019164158_admin_inbound_email_private_foundation`
5. `20261019164218_admin_email_recipient_validation_correction`
6. `20261019164253_admin_email_upsert_conflict_index`
7. `20261019164540_ifund_admin_mail_access_control`
8. `20261019165248_ifund_admin_mail_access_audit`
9. `20261019201418_fundraising_mail_subdomain_text_only_grace_storage`
10. `20261019201605_fundraising_outreach_agent_permissions_foundation`
11. `20261020044731_ifund_mail_atomic_read_audit`
12. `20261021064337_create_private_ifund_campaign_shadow`
13. `20261021223621_extend_private_campaign_shadow_nonfinancial_parity`
14. `20261023012122_ifund_private_workflow_queue_initial`
15. `20261023012527_ifund_workflow_atomic_claim_and_completion`
16. `20261023013549_ifund_workflow_lease_fencing`
17. `20261023013721_ifund_workflow_guarded_enqueue`
18. `20261023013815_ifund_core_private_migration_staging`
19. `20261023053831_ifund_private_agent_delegation_activity_shadow`
20. `20261023073825_ifund_agent_shadow_verified_identity_and_campaign_gate`
21. `20261023084110_ifund_owner_candidate_email_matches_unverified`
22. `20261023103745_ifund_owner_proof_service_only_atomic_rpc`
23. `20261023184125_ifund_active_campaign_preview_service_only_20261023`
24. `20261023225544_ifund_owner_scoped_private_campaign_preview_rpc`
25. `20261024232855_ifund_content_shadow`

**VERIFIED table-list subset:** `ifund_ops.workflow_jobs`, `ifund_ops.workflow_control`, `ifund_ops.workflow_execution_log` and three `public` mail tables all had RLS enabled. The three workflow tables show zero rows in the list summary; this is **not** a proof of all internal/private schemas or all source entity counts. Existing `ifund_ops`, existing functions and private shadow schemas must not be recreated or mutated without review. None of the new scaffold SQL was applied by this effort.

## Cutover rules
Do not merge old PR #136 (based on pre-reset history). Source of truth: issue #137. Do not deploy, change Wix/Cloudflare DNS, alter provider dashboards, or run production DDL/export operations in this phase. All pending evidence and ownership actions remain explicit blockers. No estimated effort is an assertion of readiness.

## B7 — Dependency lockfile and build verification
**PARTIALLY RESOLVED (2026-10-24).** A `package-lock.json` now exists with 210 dependency-metadata entries, including TailwindCSS, PostCSS, Autoprefixer and zero Base44 package entries. To avoid using paid build resources, the lock tree was assembled by retaining verified package-integrity metadata from existing npm lockfiles, with exact direct package versions, rather than running `npm install`; this is **not** a claim of successful npm resolution, installation, or reproducible build. Full `npm ci` and `npm run build` remain **UNVERIFIED**, because this local runner cannot reach `registry.npmjs.org` (EAI_AGAIN / DNS failure). The actual checked-in `package.json` uses React 18, React Router 6, Vite 6, Supabase client 2.105.4 and TailwindCSS 3.4.19; Wrangler is not a build requirement for Phase 1 and deployment is intentionally out of scope. A static metadata consistency check found matching declared direct dependencies and no unresolved lockfile dependency paths, but this does not substitute for `npm ci`. Next proof on a no-credit runner with registry access: `npm ci --ignore-scripts --no-audit --no-fund`, `npm test`, `npm run build`, and `npm ls --all`. If npm reports a mismatch, regenerate lock with `npm install --package-lock-only` and commit correction before marking Phase 1 complete. **Blocks:** dependency/build certification, not static inventory. 

## B8 — Owner-approved sign-in decision and provider setup (APPROVAL REQUIRED)
**Decision recorded 2026-10-24:** Supabase Auth with Google OAuth and Facebook OAuth, plus a **numeric emailed one-time code** fallback. Instagram is a social connection only, **not an authentication provider**. Password-based sign-up and password-based login are removed from the preview `Auth.jsx`. No external provider app was created and no credentials, Supabase Auth provider setting or email template were changed.
**Blocker:** Before a real sign-in test the owner must explicitly approve changes to Google/Meta login apps and provider credentials; configure the Supabase Auth redirect allowlist and a passwordless email template with `{{ .Token }}` (not the default magic-link template), plus rate limiting. The UI is source-only and not proof providers work. For the exact verified-email ownership-link consent and fallback-to-Base44-email procedure, see [PHASE3_AUTH_PLAN](PHASE3_AUTH_PLAN.md).

## B9 — Historical source counts, NOT exported records
**UNVERIFIED as of 2026-10-24:** `interplanetary-fund2` branch `migration/owner-proof-gate-20261023`, `host/migration/content-parity-manifest.mjs`, reports `User:10`, `Campaign:27`, `PlatformConnection:32`, `Recommendation:836`, `Donation:0`, `Withdrawal:0`. This manifest describes a source snapshot, **not** a successfully run API, CLI, or service-role export with row-by-row hashes. The manifest's staged recommendation count is only `100`; it does not demonstrate complete migration. All counts, especially financial zeros, are provisional until owner-approved real export plus PayPal/Stripe ledger reconciliation. Owner approval is mandatory **before** any real Base44 data or media export.

## B10 — Phase 1 build verification and code review
Local execution environment cannot resolve npm registry DNS (`EAI_AGAIN`). Public-repository standard GitHub Actions is the no-billing run route; `.github/workflows/migration-phase1-checks.yml` is configured to execute a real npm-generated lockfile, clean `npm ci`, `npm test`, `npm run build`, and Prettier from an internet-connected runner, with only a non-production phase-branch commit for formatting and lockfile if permitted. **Report the actual workflow run and logs in STATUS.md; never claim this passed until the completed workflow reports success.**
CodeRabbit previously produced a manual `CHANGES_REQUESTED` review with four major findings: missing CSS build dependencies, anonymous draft loss, edits overwritten by session refresh, and cascading deletion of campaign history. Source fixes for the first three were already committed; the campaign user deletion FK was changed to `RESTRICT` in the proposed unapplied SQL. `.coderabbit.yaml` now adds automatic review of migration target branches. A latest-head review is requested but not a substitute for a completed review.

## B11 — Payment webhook cutover (OWNER APPROVAL REQUIRED)
Keep `https://interplanetaryfund.base44.app/functions/payPalSubscriptionWebhook` explicitly recorded as a currently **hard-coded URL in source**, not as a verified active provider dashboard registration. The provider's actual PayPal/Stripe webhook destinations, live secrets and idempotency behavior are UNKNOWN. No webhook, payout setting, PayPal account or Stripe configuration may change before the owner approves a specific plan in the separate payments PR. Old Base44 endpoint remains untouched and Base44 stays live/read-only throughout the development phases.

**B7/B10 resolution update — 2026-10-25 UTC:** [Actions run 40156868430](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/40156868430) executed a real `npm install --package-lock-only`, installed `npm ci` dependencies, passed **9/9** `npm test` checks, passed `npm run build` (Vite 6.4.3, 2.08s), and ran Prettier `--write` plus `--check`. Generated package lock and formatter changes were committed as `b62e726`. Prior local npm `EAI_AGAIN` no longer blocks reproducible **hosted** build validation. It does not establish Phase 2-7 parity; latest CodeRabbit findings and approval-gated integrations remain unresolved. 

## B12 — Runtime secret handoff and payment destination mismatch (2026-10-25, NOT CONFIGURED)
**VERIFIED names only:** The Base44 owner authenticated to CLI and listed 20 secret **names**. Cloudflare Worker secret-name reads (non-mutating) returned zero bindings for `interplanetary-fund2` and `ifund-oauth`; the unrelated `ifund-email-ingress` Worker had three existing mail secrets. This does not cover Pages variables, encrypted values, future Workers, or secret ownership. [Full inventory](SECRET_DESTINATIONS.md).

**UNKNOWN/blocks payment cutover:** Where the PayPal REST app actually sends notifications, whether its merchant matches the hosted-link receiver, how to obtain a valid `PAYPAL_WEBHOOK_ID`, and whether PayPal hosted checkout emits the expected events. The proposed [platform-support webhook PR #145](https://github.com/interplanetarysister/InterplanetaryFund/pull/145) needs `PAYPAL_MODE`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `SUPABASE_URL` and modern `SUPABASE_SECRET_KEY` (or a legacy service_role JWT). New Supabase secret keys are **not** bearer JWTs; PR #145 has a staged code fix and tests for this. No credential values were imported, no key was rotated, no new Worker configured or deployed, and no real payment was attempted.

**Critical project separation:** Both Supabase projects are active. The owner has designated the newer `ssibsfmtodgximseeqsv` target in PR #148, but the older published Pages deployment has not been safely switched. Do not point production payment Workers at the newer project until schemas, users, ledger correctness, tests and source-parity requirements pass.


## B13 — Code merged, independent production cutover still blocked (2026-10-25)

**Verified after PRs #138, #149, #150 and #151 were merged:**
- Destination Supabase `ssibsfmtodgximseeqsv`: `auth.users = 0`; `public.ifund_campaigns = 0`; `public.ifund_posts = 0`. No signed-in two-user RLS smoke test can be truthfully claimed yet.
- Cloudflare: 16 production Worker route patterns on apex/www point to `interplanetary-fund2` instead of the independent Worker in #150. The legacy Worker retains Base44-dependent behavior from the prior runtime audit.
- Pages: `interplanetaryfund-migration` production deployments disabled, production branch `migration/phase7-offline-cutover-gate`; merging the integration branch does not change the published application.
- Frontend feature flags and Worker migration preview mode remain disabled by default. The deployed PayPal webhook/ledger, payout account approval, bank/donor ownership, and provider settlement are unverified.

**Actions blocking safe Base44 shutdown:** Securely migrate verified Supabase users and campaign ownership with explicit consent, reconcile source content/media and donations, audit RLS and browser column grants with actual two-account negative tests, review/merge remaining source phases and PayPal/finance/webhooks, deploy independent Worker and Pages to a nonproduction route, prove Base44-free HTTP response parity and rollback, then separately authorize production cutover. Data import must not be faked by relabeling the private legacy snapshot tables.

**Merge queue:** #139–#143 currently have conflicts after #138 landed and unresolved review findings. Resolve their conflicts and review findings one at a time rather than force-merging old stacked changes; #141/#142 contain API/UI implementations already extracted cleanly to merged #150/#151. #144/#146/#147/#148 are draft/review-gated; #145 platform-support payments alone are not campaign donations and withdrawals. Obsolete #136 must never be merged.
