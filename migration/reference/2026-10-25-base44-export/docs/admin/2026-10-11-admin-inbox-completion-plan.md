# Interplanetary Fund — Admin Inbox Completion and Verification Plan

Audit date: 2026-10-11
Authoritative application: Base44 IFund (app ID 6a67a778342a8fe05ee79cba), main.
Scope: internal Admin Action Inbox (`AdminApproval` and `AdminActionMessage`), `SupportTicket`, official account and platform connection records. This is an **implementation plan**, not evidence of deployment or task execution.

## Verified inventory

- **18 AdminApproval records:** 9 pending, 7 approved, 2 investigating, 0 executed, 0 cancelled, 0 denied. An approval is not proof of execution.
- **6 AdminActionMessage records.**
- **1 open SupportTicket:** October 9, 2026, subject “Platform connections,” asking why connections are not working.
- **0 InboxItem records:** separate from AdminApproval and SupportTicket.
- **9 PlatformOwnedAccount records:** 3 planned (Facebook business Page, Instagram brand account, Facebook group) and 6 setup_in_progress (Facebook, Threads, LinkedIn, Reddit, Bluesky, Mastodon). None is `active`; none has a `connection_id` or `last_posted_at`. Real account ownership and publishing are not verified by these rows.
- **30 PlatformConnection records:** both connected and error/reauthorization states exist, sometimes for the same provider or different identities. A `connected`/ `verified` flag on a URL or read-only profile is not proof of permission to post.
- App workspace connector catalogue lists `linkedin` connected with `w_member_social`, `facebook_pages` connected with `pages_manage_posts`, and `discord` connected with read/identity scopes. These are *workspace connector registrations*, **not evidence of the app user's platform-owned account identity or usable per-user publish token**. Instagram is not connected in that catalogue.
- Payment flags: `stripe_checkout=false`, `crypto_donations=false`, `paypal_checkout=true`, `paypal_donation_reconciliation=true`. PlatformAccessRegistry reports Stripe and PayPal DISCONNECTED; a registry status alone is not a webhook-verified transaction audit.
- No `FinancialOperation` records were returned by the specific audit query. Do not infer no payments were received; independently reconcile payment processor transactions, `Donation`, `WebhookEvent`, `HoldingLedgerEntry`, and payment operations.

## P0 — Correct the admin action engine (before fulfilling inbox items)

**P0.1: Accurate statuses, approvals and processing.** Refactor `src/components/admin/AdminApprovalQueue.jsx` and add an authenticated server-side state-transition/dispatch function. Distinguish **Needs decision** (pending), **Waiting for evidence** (needs_information/investigating), **Approved — not executed**, **In progress**, **Executed with proof**, **Declined**, and **Cancelled/obsolete**. Never show an approved item as awaiting another decision. Do not mark `executed` simply because an approval was clicked. Only transition to executed after checking proof stored in an execution log, linked PlatformOwnedAccount and/or external-provider result.

**P0.2: Dispatch authorized actions, not database illusions.** `create_platform_account`, `connect_platform_account`, `configure_reown_project`, and `publish_platform_weekly_update` currently lack a common verified executor. `connect_platform_account` targets a PlatformOwnedAccount entity ID, whereas the existing approval UI only has special handling for `create_platform_account` and one weekly-post action. An approval must initiate the correct authorized workflow or enter a clear human/provider-step-required status. An internal row `setup_in_progress` is NOT a provider account. Never fabricate login, account creation, publish confirmation or OAuth completion. Implement idempotent dispatch and persist outcome.

**P0.3: Prevent duplicate requests.** `runOfficialSocialPromotion` and `maintainPlatformOwnedAccounts` currently check pending approvals, which can cause new requests when an earlier item is approved/investigating but unfinished. Deduplicate by action_type, account_type, target, and nonterminal status; prevent parallel race duplicates. Group Facebook Page and Facebook Group separately; distinguish personal Instagram vs official IFund brand Instagram.

**P0.4: Secure background execution.** `processAdminActionInbox` currently uses service-role records without an explicit handler-level scheduler/admin authorization check, and its 15-minute cron delegates to that function. Verify Base44 scheduler authentication, enforce the appropriate trusted invocation gate, rate-limit LLM answers, hide submitted credentials and redact logs. Never put passwords or tokens in AdminActionMessage; route provider OAuth to the protected Connections flow. Preserve the scheduled router only after authorized invocation is tested.

**P0.5: Include support tickets.** The Help page creates SupportTicket records, but the audited frontend has no SupportTicket admin list/triage UI. Add an admin-only **Support requests** tab with user-safe reply/triage, timestamps, ownership, and explicit resolution evidence. Include the October 9 platform-connections ticket. Avoid silently closing it.

**P0 acceptance:** all 18 tasks shown exactly once with accurate state, support ticket appears to admin, action approvals route to a real step, failing operations remain in attention state with reasons, no unauthorized invocation, no duplicate external actions or hidden exception.

## P1 — Resolve official social account tasks, without creating duplicates

**P1.1: Identify existing accounts first.** For each of the 12 `create_platform_account` approvals, compare the real provider identity and ownership against existing PlatformConnection profile URLs, workspace OAuth scopes, PlatformOwnedAccount, and the provider's own verification result. Some connections list candidate profiles for Facebook, Instagram, Threads, X, LinkedIn, TikTok, Pinterest, Reddit, YouTube, Discord and Mastodon; Bluesky has a separate connected profile. The Mastodon approval explicitly says an IFund account should already exist. **Do not launch new registrations until existence is checked.**

**P1.2: The three October 10 official-account requests:**
- `6ac9e2fbba2a8e64d01f6fdf`: Facebook Business Page; currently platform-owned record `planned`, missing linked account and provider-backed publishing test.
- `6ac9e2fb743bfa7a8491869e`: official Instagram; `planned`, no verified brand-account publishing route/media test.
- `6ac9e2fb2041b46868302bf0`: official Facebook Group; `planned`, Facebook Groups posting support must not be inferred from Pages scope.

For each: authenticate the official account through the provider, confirm ownership, obtain allowed scopes, bind canonical connection ID, test an approved nonspam draft on a designated controlled account, store nonsecret provider post ID/URL, then mark working. Keep copy/paste manual publishing if API action is unsupported.

**P1.3: Prioritize plausible first publishing tests.** Bluesky has a connected/verified PlatformConnection but no recorded platform-owned account binding or confirmed official post; verify its app-password route in server-only storage. LinkedIn has a workspace connector with `w_member_social`, but its stored PlatformConnection is errored and the provider identity/token scope is not confirmed. Facebook Pages has workspace `pages_manage_posts` but official Page identity not confirmed. Never post as a user who has not expressly authorized it. Check account-owner consent and capture actual provider response.

**P1.4: Remaining account cases.**
- Approved but unfinished: Facebook, Bluesky, Reddit, LinkedIn, Threads.
- Pending: Discord, YouTube, Pinterest, TikTok, X, Instagram.
- Investigating: Mastodon.
- Credentials for Discord/YouTube are marked invalid in approval metadata; use provider-authorized reauthentication without reading secrets from ordinary inbox messages.
- Publish channels other than proven Bluesky/LinkedIn remain manual where a real writer has not passed provider testing.

**P1 acceptance:** each task has a canonical account identity and a state of `existing_verified`, `created_verified`, `provider_action_required`, `unsupported_manual` or `not_authorized`; every direct-publish claim includes owner consent, supported scope, provider-confirmed test result, and error/retry handling.

## P2 — Retire obsolete payment tasks and reconcile real donation readiness

**P2.1: Stripe (do not restart).** `6ac76bb4345bcb52c358eebf` (“Enable Stripe crypto acceptance,” approved) and `6ac76bb4345bcb52c358eec0` (“Verify Stripe donation webhook,” investigating) conflict with the owner's later requirement to remove Stripe and retain PayPal. Treat as **superseded** unless the owner gives new explicit direction; preserve audit history and stop any recurring Stripe setup agent requests. Validate removal of live Stripe checkout links and references without disrupting historical accounting.

**P2.2: Reown wallet request.** `6ac76bb4345bcb52c358eec1` is approved, but there is no provider-tested wallet implementation here. Determine whether Reown is required for IFund's wallet-neutral multi-chain crypto checkout. Keep `crypto_donations=false` until compatible provider, token/network controls, campaign-crediting/settlement ledger, custody/security and legal requirements are proved. No chargeable registrations or fund transfers as part of initial test.

**P2.3: PayPal and support-ticket reconciliation.** The October 9 connection complaint remains open, while app data reports PayPal DISCONNECTED even though PayPal checkout/reconciliation flags are on. Treat as a launch-safety check separate from the Stripe queue: verify correct IFund PayPal business merchant, test receipts and webhooks, match external capture to Donation/HoldingLedgerEntry/FinancialOperation, repair missed campaign totals idempotently, and confirm user-visible receipts. Never claim missing bank transactions solely because internal tables are empty. Do not change real balances until processor evidence is reconciled.

**P2 acceptance:** obsolete Stripe tasks closed with an explicit superseded rationale, Reown either tested/approved or recorded blocked with reason, PayPal capture/ledger and campaign totals confirmed with exact provider transaction evidence, and original support ticket closed only after user issue is resolved.

## P3 — Clean up provider-capability truth and admin UX

- Reconcile stored `FundraisingProviderCapability` rows that say import/sync is `verified` when relevant live PlatformConnection is `error`; provider documentation is not a live connection.
- Separate `connected` for **read or profile link** from `can publish`, `can create external fundraiser`, `can import`, and `can withdraw`.
- Review 6 AdminActionMessage rows and normalize stale `processing_status:new` for message types that do not require agent responses. Do not delete conversation history or private security audit records.
- Display “Blocked by external provider”, “Action needed”, “In progress” with human-readable single-action next steps; no infinite spinners, no inaccessible mobile approval buttons.
- Include an admin audit filter by risk, provider, status and most recent evidence. Paginate instead of fetching all 200 approvals and 100 messages for every row simultaneously.

## Delivery order and gates

1. **Audit snapshot (completed, 2026-10-11)** and user review of existing account identities; source of truth is Base44 main, not GitHub Actions.
2. **P0 inbox engine and support ticket screen** with unit/regression checks and safe migration; test every transition including missing credentials and duplicate approval.
3. **P1 provider identity verification** starting with Facebook Page, Instagram, Bluesky and LinkedIn; implement one integration at a time, use authorized test accounts, publish only with explicit permission. Confirm actual provider post URLs before labeling working.
4. **P2 payment safety** with PayPal-first verification; formally supersede Stripe actions once checked against owner instructions. Keep crypto disabled until audited.
5. **P3 cleanup and monitoring**, with one canonical provider capability matrix and no phantom active connections.
6. **Release gate:** Node 22, lint, typecheck, release script in validation-only mode, browser/mobile tests, backend authorization/regression checks, then a Base44 checkpoint. Publish only with authorized Base44 session; compare live release asset and manifest after deploy. If blocked, report as **code ready / not published**.

## Definition of completion

An inbox item is `executed` only after its requested real-world action is verified against the provider or a supported audited local outcome; otherwise record the specific blocker and preserve user control. No new provider accounts created from guesses; no passwords stored in inbox; no external funds assigned to IFund ledger without payment settlement evidence; no live provider publishing from sandbox-only test results.
