# iFund Agent Team, Connections and Paid Membership — Nov 18 2026

## Verified canonical source
- Main project: `interplanetarysister/InterplanetaryFund`, active development branch `feature/agent-team-question-routing-20261118` based on `feature/route-completion-20261113`.
- Existing /agents page had **routing recommendations only**. It did not transmit a question to any provider.
- New `worker/agents/teamQuestion.js` and `/api/agents/team/question` provide an actual, authenticated, model-backed advisory reply. The backend chooses the specialist from the reviewed directory or accepts an explicitly selected specialist. All nine roles share a model with role-specific skills and instructions; **this does not start an independently provisioned model or privileged tool for each role**.
- The page has a send form, returned named-agent answer, permission links, typed errors and request cancellation across account changes. Free route recommendations remain accessible. The direct model answer is **paid/verified member only**, behind IFUND_TEAM_QUESTIONS_ENABLED, verified AI permission and the server quota.
- Team context uses the existing same-owner, credential-redacting history RPCs when IFUND_TEAM_CONTEXT_ENABLED is enabled. No cross-account context or external social/publishing authorization.

## Free features versus subscriptions
**Free, existing or connected-to-free service subject to normal login/feature availability**: browsing, campaign drafting and publishing within the existing campaign rules, public fundraiser links and manual sharing, campaign metrics/readiness tools, connection setup guidance and provider-backed OAuth where actually configured, user-controlled sharing choices, agent identification/routing, available basic workspaces and fundraising education.

**Basic AI Assistant, provider catalog $12/month**: intended to enable paid Story drafting and advisory team questions only when subscription entitlement `ifund_story_subscription` confirms active level 1+, the member explicitly enables campaign AI drafting and provider capacity/configuration is accepted. The new question quota is 20 per UTC day for level 1, 40 for levels 2 and 60 for levels 3+ (source only). This is not unlimited and never includes permission for external posts.

**Catalog entries currently NOT provider-ready**: Basic annual $115; Outreach monthly $49 / annual $470; Professional monthly $99 / annual $950; Nonprofit monthly $29 / annual $280; Enterprise monthly $199 / annual $1,910. These prices are records, not an offer available for checkout. Do not invent capabilities or unlock paid tools until a verified entitlement/capability registry supports them.

**Connection permission distinctions**: a saved public URL is NOT a verified OAuth account, verified OAuth is NOT publishing approval, a user's draft/share preference is NOT a completed post, and a paid AI entitlement is NOT third-party provider authorization. Manual publishing remains the user's choice. Automatic posting requires verified provider-specific scope, explicitly authorized destination and delivery receipt, moderation and idempotency.

## Production read-only findings
- Production Supabase `ssibsfmtodgximseeqsv` shows one active Basic monthly subscription catalog row with nonempty PayPal plan+webhook references and verification timestamps; the other nine catalog rows remain inactive without provider readiness.
- Production has **zero subscription intents and ledger rows** at this check.
- `public.ifund_apply_verified_subscription_event(jsonb)` **does not exist** in production. It is required for atomic, replay-safe billing and must not be skipped, so new enrollments cannot be declared end-to-end ready.
- Cloudflare `ifund-payments` Worker is configured with `IFUND_PAYMENTS_ENABLED=true`, `IFUND_PAYPAL_MODE=live`, but its subscription start endpoint still checks independently accepted subscription readiness. Do not infer readiness from the payment flag.
- Cloudflare `ifund-oauth` advertises `OAUTH_ENABLED=true`, but this alone does NOT verify any specific provider registration or user connection; separate canonical OAuth gateway and per-provider credentials/permissions remain subject to testing.
- Existing main site /subscriptions contains signed-in PayPal status/cancel/start flow; new UX in this branch is source only. Mobile purchases remain disabled pending app-store acceptance.

## New source implementation
- `apps/web/src/pages/AgentsTeam.jsx`: direct question/answer UI and free specialist routing.
- `apps/web/src/lib/agentQuestions.js`: authenticated owner session verified before and after response, no default external action.
- `worker/agents/teamQuestion.js` + `worker/index.js`: advisory AI gateway; no financial, publishing or admin tools.
- `supabase/migrations/20261118190000_ifund_agent_question_quota.sql`: per-verified-member atomic daily idempotent reservation, fail closed when paid entitlement inactive; shared logic applies to all future users.
- `supabase/migrations/20261118200000_ifund_subscription_verified_entitlements.sql`: source-only trigger projection of paid entitlements from provider-verified immutable atomic ledger rows, never redirects or unverified intents. Preserve other grants.
- `apps/web/src/pages/Connections.jsx`: three-step onboarding, OAuth/saved-link/AI draft/automation readiness summary, mobile auto-navigation to selected provider.
- `apps/web/src/lib/planCapabilities.mjs`, `apps/web/src/pages/Subscriptions.jsx`, `apps/web/src/pages/PublicSubscriptionPlans.jsx`: free-first organized monthly/annual comparison and server/provider-gated pay buttons; explicit unverified/unsupported capability labels and no native purchases.
- `tests/ifund-agent-team-questions.test.js`, `apps/web/tests/plan-capabilities.test.mjs`: positive/negative source and unit fixtures. Full Node/browser/PGlite suite not yet executed.

## Explicit release gates
1. Independently run Node/Vite/browser tests (320px, keyboard, account A→B→A), including real model call availability, blocked flag, billing and OAuth failures.
2. Apply and independently verify existing atomic subscription SQL (PRIOR to entitlement trigger), with webhook resource provenance, cross-owner RLS, refund/cancel/replay and paid-level activation/revocation tests. No checkout activation before evidence. Never use live PayPal money as a test fixture.
3. Validate the paid access source against `ifund_access.member_entitlements` and the MemberAccess/Story worker; verify cancellation/reversal revokes the paid entitlement and existing historical user entitlements remain intact.
4. Verify OAuth provider secrets, redirect exact-origin checks, signed authorization and per-scope consent for each platform. Do not mark external publishing as live until destination API acceptance and delivery receipts exist.
5. Enforce deployment/account budget for Workers AI and hard stops before turning on IFUND_TEAM_QUESTIONS_ENABLED. Staging first, no GitHub-hosted Actions minutes during November, full-site release gate stays closed unless all required route acceptance is independently completed.
6. Production release requires explicit verified acceptance and deployment evidence; commits and one verified provider row are not proof of a working end-to-end subscription.


## Question quota reservation recovery (source only)

The daily Agent Team allowance now uses a short-lived reservation rather than charging a question permanently at the first request. Each reservation is bound to the owner, request ID, input SHA-256 and selected specialist, expires after 10 minutes, and is finalized only after a usable answer and any enabled owner-context write succeed. Provider/context failures release the reservation; an abandoned reservation can be retried after expiry. Completed questions remain counted against the daily 20/40/60 entitlement limit. The reserve, complete and release RPCs are owner-scoped and authenticated-only.

The SQL migration stack (atomic PayPal prerequisite 20261116034738, question quota 20261118190000, and verified subscription projection 20261118200000) was executed against the current production schema inside one explicit transaction and rolled back. PostgreSQL accepted the full sequence and the expected functions/columns/tables existed inside the transaction. No production schema changes were retained. The actual Node test runner, Worker deployment, Workers AI inference, payment webhook, merchant verification and browser acceptance remain outstanding.
