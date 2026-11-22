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
