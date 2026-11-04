# First increment: Story preview and auth repair

Baseline: destination `d4caa4bfc68e43c68bf40f5efc13930927132940`; read-only source `fb2afc64d72194c51c552bc7b5260a479d7566eb`.

## Implemented and verified locally

- Story Worker: bounded JSON input, canonical-project pinning, provider-confirmed identity, user-JWT RPCs, five titles/two summaries/story or isolated section rewriting, strict structured output, persisted-receipt success, safe provider errors and draft-only behavior.
- Additive SQL candidate reuses actual production entity tables and workflow jobs. An independent database control defaults disabled. Guarded private functions enforce confirmed email, active lifecycle, current explicit consent, owned campaign, atomic duplicate/quota checks, lease expiry, draft persistence and audit receipts. No direct browser table privileges are added.
- New `/agents` preview screen lists private suggestions, prepares drafts and cancels owned suggestions. It is not the original full agent-chat surface and cannot approve or publish.
- Signup/login/recovery code adds explicit callbacks, confirmation/resend/code handling, safe return routes, password confirmation, provider-verified email state and old-link rescue. Auth route keys prevent signup state leaking into login.
- Member guard invalidates stale async work on identity changes, removes the previous member's private child state, and preserves unsaved text on same-user refresh/tab-focus events.

Focused execution: **12 Story Worker cases, 4 Postgres scenarios, 5 auth-helper cases** pass. The Postgres scenarios execute the actual candidate SQL and source-generated entity constraints using PGlite. They cover owner separation, account lifecycle/consent, anonymous denial, duplicate and mismatched requests, malformed output, lease theft/expiry, global quota, audit receipt, cancellation and disabled database control. PGlite is not a hosted PostgREST or real Supabase login test.

The final available root suite passed all 30 test files (including the 12 Worker cases and 4 SQL scenarios). The canonical web test suite passed all **23 test files**. The canonical Vite frontend and standalone bundled Story Worker build pass. Existing dependencies were used; no new paid services or dependencies were purchased.

## Mocked browser evidence

Using the built canonical `apps/web` artifact, Chromium at **390 × 844**, and mocked Supabase/API responses:

1. Signup submits a fixed `/auth/callback` redirect preserving `/agents`; pending confirmation can transition back to password login.
2. An old `/dashboard#access_token=...` link establishes a confirmed session and clears URL credentials.
3. A same-user token refresh preserves unsent text.
4. A real mocked sign-in in a second tab changes identity, removes the previous owner's private drafts and clears their unsent form.
5. The Story screen has no horizontal overflow at that viewport.
6. Token-hash recovery verifies the session, clears URL credentials, updates the password and returns to login.

No real email was sent, no real user was created, and these mock tests do not establish SMTP, social OAuth or live password success. Run with installed Python Playwright + Chromium: build `apps/web` using the canonical Supabase URL and the mock public key `sb_publishable_mock_browser_test`, then run `python3 tests/browser/run-story-auth-preview.py` from the repo root. This uses a local strict port and routes backend requests to fixtures.

## Independent review

Reviewer 2 identified and the builder corrected account-switch disclosure, old-link breakage, terminal retry handling, auth mode persistence, callback router subscription and same-user refresh form loss. Reviewer reran focused tests and found no additional blocking code issue. Live parity remains unverified; review is not release approval.

## Explicitly incomplete; do not start agent 2

- Subscription entitlement reconciliation for the full original agent service.
- Complete verified owner account/connection context, writing research and historical scoped memory/correction/deletion.
- Canonical conversion of accepted multi-option preview suggestions into `campaign_changes` payloads. Preview records are distinctly tagged `ifund_story_v1` and must never flow through generic apply/publish handlers.
- Complete source tool parity, specialist routing and original member chat behavior.
- Hosted SQL/PostgREST execution, live two-owner identity checks and real Workers AI inference. AI remains disabled until account free allocation is verified.
- Supabase Auth URL allowlist/templates/SMTP/social-provider settings and real signup/recovery mailbox verification. The connected Supabase tools do not expose Auth settings management. A read-only live settings check confirmed email auth/signup enabled, email auto-confirm disabled, and Google/Facebook disabled. The owner-authorized existing-address email-login request was accepted; mailbox receipt and link completion are pending. Live Auth logs show invalid-credentials failures, which require real account verification rather than weakened checks.
- Mobile/Android parity beyond the mocked viewport and release/cutover gates.

The SQL remains **UNAPPLIED**. No production frontend promotion, domain/mail changes, legacy retirement, payment activation or financial mutation was performed. A disabled isolated Worker deployment, if created, is catalogued separately with its exact version and health result. It does not complete the Story Agent.

## Resume and rollback

Complete the missing Story contracts and independent live acceptance first. Only then mark Story complete and begin Strategy. Keep the database and Worker controls disabled until their own acceptance gates pass. A preview rollback disables the isolated Worker or removes its preview binding; there is no production route to restore. Do not apply the SQL with a guessed migration filename: generate it with the installed Supabase CLI after reconciliation, or use the connected migration tool and persist its returned migration version.
