# Interplanetary Fund — weekly agent training runtime checkpoint (2026-11-22)

## Deployed and verified

- Supabase project `ssibsfmtodgximseeqsv`.
- Edge Function `ifund-weekly-agent-training`, production version 3, with a private Vault-backed request-token check. It has `verify_jwt=false` because this dedicated endpoint validates its own high-entropy service token through a restricted service-role RPC; it **does not** accept public unauthenticated requests.
- Weekly starter Cron `ifund-training-weekly-start` runs `0 10 * * 0` (10:00 UTC Sundays; 2 AM PST / 3 AM PDT).
- Dedicated worker Cron `ifund-training-worker` runs every 15 minutes, invoking the same function's `work` action. The function declines the work request *before claiming a job* when no authorized research provider is configured.
- Database schema `ifund_training`: private `runs`, `jobs`, `candidates`, `evaluations`, `audit`, and `settings` tables with private permissions/RLS and indexes.
- Restricted service-role RPCs: `ifund_training_authorize`, `ifund_training_start`, `ifund_training_claim`, `ifund_training_finish`.
- Nine registered specialist identifiers: nexus, story, orbit, polaris, forge, echo, pulse, link, discover. Role/practicum authoritative reference: `apps/web/src/lib/agentTrainingDirectory.mjs` and `apps/web/src/lib/agentWorkforceTraining.mjs`.
- Real HTTP 200 test created nine distinct jobs for the 2026-11-22 training week. Another authorized HTTP 200 test returned `provider_not_configured` with `job_claimed:false`.
- Retry path is capped at two attempts, and model candidate citations must match the Responses API's returned URL-citation annotations. Candidate evaluations default to **failed/unapproved**, never automatically change production behavior.

Supabase migrations applied: `ifund_weekly_agent_training_control_plane`, `ifund_weekly_agent_training_cron`, `ifund_training_bounded_retries_and_evidence_checks`, and `ifund_training_private_rls_and_indexes`.

## Not yet accepted as operational

The optional OpenAI Responses API provider remains disabled without an approved `OPENAI_API_KEY`. The ChatGPT Deep Research connector is not a callable Supabase backend credential. To avoid transferring credentials between tools, an isolated **Cloudflare Workers AI** research Worker `ifund-training-research` was deployed using a dedicated D1 database `ifund-agent-training-research` (UUID `0068715f-bcdf-4f3d-8884-f7870c054660`). Its Cron schedule `*/5 10-13 * * SUN` searches/summarizes public official-source pages only; no account data or user financial data is sent. Its read-only public-source results endpoint is `https://ifund-training-research.interplanetary-fund.workers.dev/results`. Supabase Edge Function v4 polls the endpoint for completed signed-off-schema **candidate-only** research and durably records candidates with evaluation required. Worker code and configuration are version-controlled at `worker/training/`. Real scheduled Workers AI inference completion was NOT observed in the current acceptance window; research remains pending. Do not claim success until D1 and Supabase have real completed receipts.

No evidence yet supports successful production research, actual external browser automation, credible comparative skill evaluations, independent specialist improvement, shared skill activation, Trigger.dev use, or a live production agent using an approved skill. The deterministic rule-based practicum in source is not proof of model-quality gains. Do not represent scheduling, queue creation, or code deployment as genuine training completion.

## Safety

- No payment actions, real donor records, user private conversations, or provider account permissions were read or modified for this feature.
- The private schema is not exposed to public `anon` or `authenticated` data access.
- Candidates stay in `pending_review` with independent evaluation needed. There is no automatic production-prompt rewrite.
- External research is disabled if the provider is unconfigured and pending jobs are retained for later processing.

## Acceptance remaining

1. Verify that the isolated Cloudflare scheduled Workers AI research actually fetches at least two real authoritative URLs per specialist, returns valid JSON and populates D1, and that all nine are ingested into Supabase. Optional OpenAI Deep Research remains disabled unless separately authorized.
2. Implement a real evaluation worker using the professional training rubric, synthetic fixtures, and independently scored baseline-versus-candidate comparisons.
3. Implement approved knowledge retrieval at the existing Workers AI team gateway while preserving owner privacy and tool-permission boundaries.
4. Verify run completion for all nine agents, durable retry/lease behavior, run summaries, operational alarms, and actual user-agent improvement in an isolated acceptance environment.
5. If dynamic web interaction is demonstrated necessary, integrate a permitted browser provider as an optional, budget-limited tool; do not silently enable paid services.

The live website's unrelated functions and payment integrations were not redeployed for this work.

## Additional verified production checkpoint — November 22, 2026, 11:32 UTC

- The standalone Cloudflare Worker `ifund-training-research` is deployed with Workers AI and isolated public-research D1; its read-only `/results` API returns only public-source research and candidate suggestions. The temporary `/diagnostic` endpoint was removed and a subsequent HTTP 404 verified.
- Cloudflare research Cron is `*/5 10-13 * * SUN`; Cloudflare uses Sunday=1/SUN, unlike Supabase's Sunday=0.
- Production Supabase Edge Function is now version 8; weekly starter Cron remains `0 10 * * 0`, and the authenticated ingestion Cron was increased to `*/5 * * * *`.
- A live Cloudflare Workers AI invocation successfully researched NEXUS, and authenticated Supabase ingestion returned HTTP 200 with NEXUS's corresponding job `completed` and two candidate skills `pending_review`. Neither candidate was approved or installed into live agents.
- Cloudflare also completed STORY public-source research. Its preliminary evidence-critic invocation initially returned no usable verdict, so the two reviews failed closed; the critic was adjusted to use the independently available Gemma 4 model with bounded source excerpts and now stores diagnostic failure information. This correction has not yet passed a completed grader acceptance run.
- Supabase strictly binds job claims to the matching training week, handles retries and terminal research failures, captures preliminary evidence critiques, quarantines unsupported proposed skills, and generates machine-readable weekly synthesis and an administrator review queue.
- The database now holds all nine synthetic professional-practicum cases and a versioned skill registry. Skill promotion requires a verified super-administrator and independent validated evaluation. Cross-specialist consultation suggestions are review-only; NEXUS generated 16 suggestions from its two candidate skills.
- The approved-skill retrieval RPC is available to active authenticated members and has been integrated into the canonical GitHub agent-question source with a regression test. **That source change has not been separately accepted via an authenticated live member/admin browser test or verified deployed on the existing agent-question gateway.**
- A backend policy enforces `enabled=true`, `allow_paid_requests=false`, and `budget_usd=0` for the optional OpenAI API path. The Cloudflare Workers AI daily free allocation is separate and account-wide; the Cloudflare billing subscription API returned HTTP 403, so external account billing settings were not verified. No new paid vendor/service was provisioned.
- The first complete research-to-Supabase receipt is proven; a full nine-agent successful weekly training, independent baseline/candidate outcome regression, Browserbase/Trigger.dev integration, and autonomous agent production improvement are **NOT YET verified**. Do not interpret model-generated skill suggestions as model retraining or guaranteed user success.
- All current SQL migrations, Edge Function code, Cloudflare Worker code/config, and runtime checkpoints are version-controlled in `interplanetarysister/InterplanetaryFund` on `main`; production website and payments were not redeployed.
