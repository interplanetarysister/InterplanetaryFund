# Production agent automation and R2 reference checkpoint — 2026-11-26 UTC

## Canonical targets
- Cloudflare account: `c95db4f2c901f32776471b85f1eda15d` (iFund; **not** Michelle Rogers Executive account).
- Supabase project: `ssibsfmtodgximseeqsv`.
- GitHub: `interplanetarysister/InterplanetaryFund`, production branch `main`.
- Frontend Pages project: `interplanetaryfund-migration`, public `interplanetaryfund.com`.
- Existing R2 bucket: `ifund-media`; do not create another bucket for these integrations.

## Autonomous operations — verified live
- Worker: `ifund-agent-ops-autonomy`, new configured version `4008dd30-c851-47d2-9817-232707a65101`, deployed at **100%**.
- Worker bindings: `AI`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `IFUND_OPS_BOT_TOKEN` (secret_text), `IFUND_OPS_AUTONOMY_ENABLED=enabled`.
- Dedicated random executor secret was generated **inside Cloudflare**, not put in a repository, client bundle or transcript. Matching SHA-256 fingerprint resides solely in private Supabase control; never log or export the token.
- Supabase `ifund_private.ifund_ops_bot_control.enabled=true`; `IFUND_OPS_BOT_TOKEN` hash comparison is enforced by `ifund_private.ifund_ops_bot_valid`.
- Cron `*/30 * * * *` (UTC, every 30 minutes).
- `ifund_ops_bot_claim` enforces a hard **8-run UTC daily limit**, includes failed runs, leases claims, and prevents duplicate handling. Agent consultations remain advisory only.
- **First fully verified cron execution**: run `b3fbd087-d629-4b83-bdb1-ea8f845aef9d` for previously posted admin discussion `1b1610b3-2dc3-4187-ba97-706638bfc7a0`; claimed at `2026-11-26T13:00:25Z`, status `completed` at `13:00:37Z`; three durable private messages: Discover analysis, Pulse analysis, NEXUS synthesis.
- The Worker cannot transfer funds, grant roles, publish content, perform external provider actions or modify subscriptions. Those stay in their dedicated authenticated owner workflows.
- Existing `ifund-workflows` runs separately at `*/15 * * * *` and remains enabled; do not duplicate the job.

## Private campaign documents — integrated read-only references
- New R2 media, document upload/delete and cover management deployed on Pages from main `fc155623919a63fe77c8071c19c14dea784feccf`. That production deployment passed **100 root tests, 1,306 web tests, Vite build**, all Cloudflare publish stages.
- Owner-approved campaign document *summaries* are available to Story (`ifund-story-agent`), Polaris (`ifund-strategy-agent-preview`), Forge (`ifund-growth-agent-preview`), and Echo (`ifund-communications-agent-preview`). All four have `IFUND_CAMPAIGN_DOCUMENTS_ENABLED=enabled` and retained existing AI and executor bindings.
- `public.ifund_campaign_agent_document_briefs` is authenticated-only; anonymous EXECUTE denied, document table RLS enabled. RPC uses `auth.uid()` and only includes documents with `allow_agent_use=true`, `deletion_requested_at is null`, same campaign, max 6; forwards reviewed summaries and bounded text excerpts only, never raw R2 file bytes.
- No live signed-in owner acceptance of this reference reading was available during this audit. Do not describe it as end-user verified.

## Shared team history and other gates
- Cloudflare `IFUND_TEAM_CONTEXT_ENABLED=enabled` and scoped `IFUND_WORKFORCE_EXECUTOR_KEY` secret binding were present on `ifund-agent-question`, Story, Strategy, Growth, Communications at the time of audit; they were provisioned independently of the autonomous bot.
- `ifund_ops.team_question_writer_control` was enabled with a private credential hash. The user/agent event and same-owner history functions existed, but **no persisted `ifund_agent_team_events` were present** as of this checkpoint, so member-authenticated save/retrieve and cross-account acceptance remained **unverified**.
- `ifund-managed-connections-agent-preview` provides managed connections without an AI binding; `ifund-what-if-ai-preview` provides its separate What If AI runtime. Do not assume these two run the shared-history adapter merely because they are connected from Pages.
- The separate admin-only reviewed-account document erasure Worker remains gated `IFUND_DOCUMENT_ERASURE_ENABLED=disabled`. The opt-in member-owned media delete path is separate and was shipped.
- Curated live public research `IFUND_AGENT_PUBLIC_RESEARCH_ENABLED` is not enabled: although the source list is allowlisted and reviewer-only, this path lacks a per-owner usage limit for unlimited repeated requests. Add quota and verify source freshness before enabling.
- Paid email checkout, payment-provider grants, and live account acceptance are **not** attested by this checkpoint.

## Operating guidance
1. On a new deployment, compare live Cloudflare bindings, cron, and 100% deployed Worker version before assuming operations run.
2. Verify successful scheduled jobs with `ifund_private.ifund_ops_bot_runs.status` **and** corresponding `public.ifund_agent_operations_messages.source_kind='verified_agent_runtime'` receipts. A Cron definition alone is not enough.
3. Preserve the 8/day AI run cap, the no-payments/no-publish advisory boundary, and fail-closed owner-scoped RLS for private sources.
4. Never rotate or copy `IFUND_OPS_BOT_TOKEN` into GitHub, Vite, client code, or a chat message.
5. Use manual Cloudflare Pages ad hoc Git deploys only after source review/tests; automatic Git deployments and GitHub Actions minutes remain disabled.

## Admin frontend release — same day
- Added `public.ifund_ops_bot_admin_status()` as a privileged **read-only** RPC gated on `public.ifund_current_user_is_verified_admin()`. It exposes only the enabled status, current UTC-day run count and 8-run limit, and the latest run's status/timestamps; it does **not** return the secret fingerprint, account data or private message content.
- The RPC grants EXECUTE to authenticated only; anonymous grants revoked. Production verification: `anon_can_read=false`, `member_can_call=true`, and unauthenticated direct execution rejected with SQLSTATE `42501` and `Administrator access required`.
- `apps/web/src/components/agents/AgentOperationsRoom.jsx` now displays the verified run summary, fetching it alongside admin room messages and clearing status on auth changes. Missing receipts do not fabricate success.
- Squash PR #390 to main commit `b5aaadb7e0d9ad5a5a26707f27152fe24d0cf242`, Cloudflare production deployment `2cbe0ee1-2a8a-4c42-b0af-4e0c621fa9c0` **all stages success** with **100/100 root, 1,307/1,307 frontend tests, and successful Vite build**. Public apex, www and preview aliases point to that deployment.
- Supabase advisor labels this new authenticated SECURITY DEFINER RPC as a generic warning; the exposure is intentional and defended by live verified-admin checks in the body and restricted execute grants. Do not remove the admin guard.
- Build emits an informational Wrangler auto-discovery warning because root `wrangler.jsonc` is a **Workers API** config, not the Pages frontend project. The build correctly skips that file and compiles Pages Functions. Do not add Pages output settings to the Workers API config merely to suppress the warning.
