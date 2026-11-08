# First increment: Story preview and auth repair

Baseline: destination `d4caa4bfc68e43c68bf40f5efc13930927132940`; read-only source `fb2afc64d72194c51c552bc7b5260a479d7566eb`.

## Implemented and verified locally

- Story Worker: bounded JSON input, canonical-project pinning, provider-confirmed identity, user-JWT RPCs, five titles/two summaries/story or isolated section rewriting, strict structured output, persisted-receipt success, safe provider errors and draft-only behavior.
- Additive SQL candidate reuses actual production entity tables and workflow jobs. An independent database control defaults disabled. Guarded private functions enforce confirmed email, active lifecycle, current explicit consent, owned campaign, atomic duplicate/quota checks, lease expiry, draft persistence and audit receipts. No direct browser table privileges are added.
- New `/agents` preview screen lists private suggestions, prepares drafts and cancels owned suggestions. It is not the original full agent-chat surface and cannot approve or publish.
- Signup/login/recovery code adds explicit callbacks, confirmation/resend/code handling, safe return routes, password confirmation, provider-verified email state and old-link rescue. Auth route keys prevent signup state leaking into login.
- Member guard invalidates stale async work on identity changes, removes the previous member's private child state, and preserves unsaved text on same-user refresh/tab-focus events.

Focused execution: **18 Story Worker cases, 9 Postgres scenarios, 5 auth-helper cases** pass. The Postgres scenarios execute the actual candidate SQL and source-generated entity constraints using PGlite. They cover owner separation, account lifecycle/consent, anonymous denial, duplicate and mismatched requests, malformed output, lease theft/expiry, global quota, audit receipt, cancellation and disabled database control. PGlite is not a hosted PostgREST or real Supabase login test.

The final available root suite passed all 30 test files (including the 18 Worker cases and 9 SQL scenarios). The canonical web test suite passed all **23 test files**. The canonical Vite frontend and standalone bundled Story Worker build pass. Existing dependencies were used; no new paid services or dependencies were purchased.

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

- Provider ingestion of future subscription receipts remains unimplemented. The server-owned eligibility contract is now implemented: the existing verified-admin check grants the source-equivalent enterprise level; otherwise only typed, unexpired provider-verified entitlement records can grant AI access. Staged subscription strings and browser metadata grant no access.
- Historical memory and legacy connection-capability migration remain unverified. Current canonical owner/campaign/profile/post/connection context and verified-source research reads are implemented. Explicit owner/campaign preferences support scoped overrides, correction, deletion after plan expiry and a deletion generation guard that rejects delayed stale saves.
- Campaign application/publication remains unimplemented. Explicit title/summary selection now creates an idempotent canonical `campaign_changes` draft containing only title/summary/story. Wording edits use compare-and-set revisions; no campaign is changed. The source suggestion stays distinctly tagged.
- Complete source tool parity, specialist routing and original member chat behavior.
- Hosted SQL/PostgREST and live two-owner acceptance remain unverified. The owner confirmed all service plans are Free except Codex Pro. A real, synthetic Workers AI inference passed using JSON-Schema-capable `@cf/meta/llama-3.3-70b-instruct-fp8-fast`: 317 prompt tokens, 189 completion tokens, about 47.16 neurons. The previous llama-3.1-FP8 model rejected schema mode; it was replaced and object responses are validated. Total prompt input is bounded before reserving platform allowance.
- Supabase Auth URL allowlist/templates/SMTP/social-provider settings and real signup/recovery mailbox verification. The connected Supabase tools do not expose Auth settings management. A read-only live settings check confirmed email auth/signup enabled, email auto-confirm disabled, and Google/Facebook disabled. The previous increment verified real email-link login through the deployed preview and reached its agreement gate; the temporary session was revoked locally. No legal consent was submitted. Live Auth logs show invalid-credentials failures, which require real account verification rather than weakened checks.
- Mobile/Android parity beyond the mocked viewport and release/cutover gates.

The reviewed SQL is applied as **20261104043420_ifund_story_preview_contracts.sql**, initially with execution disabled. Live catalog checks confirm public wrappers are security-invoker, anon has no execute grant, and browser roles have no direct private-table grants. No production frontend promotion, domain/mail changes, legacy retirement, payment activation or financial mutation was performed. A disabled isolated Worker deployment, if created, is catalogued separately with its exact version and health result. It does not complete the Story Agent.

## Resume and rollback

Complete the missing Story contracts and independent live acceptance first. Only then mark Story complete and begin Strategy. Keep the database and Worker controls disabled until their own acceptance gates pass. A preview rollback disables the isolated Worker or removes its preview binding; there is no production route to restore. Do not apply the SQL with a guessed migration filename: generate it with the installed Supabase CLI after reconciliation, or use the connected migration tool and persist its returned migration version.

## Follow-up installation and verification status

The follow-up adds server-owned plan eligibility, reviewed research, current owner context, explicit saved preferences, canonical wording selection/editing, total model-prompt bounds and multilingual request-body support. Independent review passed the additive SQL for installation with control=false. No next platform agent was started.

Two Supabase apply_migration calls returned `status=expired`: their required tool confirmations expired. A live read after both attempts confirmed no Story schema or migration history entry. No alternate SQL channel was used to bypass that confirmation. The subsequent owner-authorized attempt succeeded: migration 20261104043420 is installed and its disabled-state privileges are verified. The owner then explicitly authorized enabling and deploying Story to production, followed by beginning agent 2. Production activation must be verified separately below.

Browser regression now covers explicit title/summary selection, canonical wording edits, separate owner/campaign preferences, serialized pending save/clear actions, delayed read invalidation, same-user refresh preservation, account switching and privacy deletion when the agent is disabled, in addition to the auth flows. All remain mocked except the separately recorded prior live email login.

## Production authorization and rollback target

The owner explicitly instructed: enable execution, push live production, then begin the second agent. This authorizes Story runtime and canonical frontend production activation; it does not authorize paid plan upgrades, payments, DNS/mail changes or Base44 shutdown. The prior production Pages deployment is `321ccced-05bf-4c3b-bd3d-dd15401df69d` from commit `68bcbb4f8e7d6f1f665e3eb7056395841058dbf9`. Preserve it for rollback. The canonical Supabase project remains `ssibsfmtodgximseeqsv`; Cloudflare account remains `c95db4f2c901f32776471b85f1eda15d`.


## Zero-Base44-credit tool adapter gate — 2026-11-08

Based on existing Managed Connections branch commit `57563539041d62d2cd84a5cbcedcb1391e64cd56`; extends its canonical `worker/services/tool-registry.js`, not a second implementation. Owner requires zero Base44 credits for both development and application agents.

Reproduced three failures before the fix: a tool marked verified-free with no zero-Base44-credit evidence was advertised and invoked; credit evidence expiring during authorization did not block execution; caller-supplied claims were not independently excluded as credit evidence. The new registry gate requires trusted, nonempty, expiring evidence bound to the exact code revision, copied at registration and rechecked before dispatch. Evidence must cover every transitive auth/tool/data/receipt dependency. Missing, unknown, included-credit, metered, stale-revision and expired evidence fails closed. Existing entitlement, OBO, administrator, exact owner approval and receipt checks are preserved.

Verification: 15 registry tests pass, including original ownership/approval/receipt checks, ten invalid-evidence variations, expiry during authorization, untrusted-input rejection and post-registration mutation. Node syntax, Prettier and git whitespace checks pass. Independent reviewer ran the focused registry/runtime suites (29 cases before the added mutation regression), reran all 15 final registry tests, and reported no blocking finding.

**Integration limit:** the registry currently has no production caller; it is exercised by tests only. This is a reviewed foundation change for the unified conversation/tool executor. No Base44 agent was reconfigured, no runtime was activated, and no cloud setting, schema, secret, model inference, payment or publishing operation changed. No account spending cap or complete zero-credit operation is claimed. No new dependency was installed; broader tests reuse the existing unchanged dependency set through a temporary local symlink.

Follow-up: wire tested independent adapters into the existing canonical unified runtime with fresh owner/campaign authorization, an actual zero-credit evidence reference per implementation, bounded tool/handoff budgets, durable leases/receipts and two-owner hosted acceptance. Do not seed synthetic test evidence into production or activate all ten roles merely because these tests pass.

Broader root regression result: `npm test` — **381 passed, 0 failed**, including the final credit-evidence tests, on Node v24.19.0. Database scenarios execute local PGlite only. No hosted database or provider mutation was performed.
