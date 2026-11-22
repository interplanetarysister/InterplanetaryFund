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

The Edge Function's optional research implementation requires an approved `OPENAI_API_KEY` and `IFUND_TRAINING_ENABLE_EXTERNAL_RESEARCH=true` in the secure Edge Function runtime. Neither was established during this audit. The ChatGPT Deep Research connector is not a callable Supabase backend credential. A separate Cloudflare Workers AI research service was investigated but **not deployed** because transferring the secret between connectors was blocked by a security control. Do not bypass that control.

No evidence yet supports successful production research, actual external browser automation, credible comparative skill evaluations, independent specialist improvement, shared skill activation, Trigger.dev use, or a live production agent using an approved skill. The deterministic rule-based practicum in source is not proof of model-quality gains. Do not represent scheduling, queue creation, or code deployment as genuine training completion.

## Safety

- No payment actions, real donor records, user private conversations, or provider account permissions were read or modified for this feature.
- The private schema is not exposed to public `anon` or `authenticated` data access.
- Candidates stay in `pending_review` with independent evaluation needed. There is no automatic production-prompt rewrite.
- External research is disabled if the provider is unconfigured and pending jobs are retained for later processing.

## Acceptance remaining

1. Connect an explicitly authorized inference/research provider through its supported secret mechanism and verify real citation-backed research calls.
2. Implement a real evaluation worker using the professional training rubric, synthetic fixtures, and independently scored baseline-versus-candidate comparisons.
3. Implement approved knowledge retrieval at the existing Workers AI team gateway while preserving owner privacy and tool-permission boundaries.
4. Verify run completion for all nine agents, durable retry/lease behavior, run summaries, operational alarms, and actual user-agent improvement in an isolated acceptance environment.
5. If dynamic web interaction is demonstrated necessary, integrate a permitted browser provider as an optional, budget-limited tool; do not silently enable paid services.

The live website's unrelated functions and payment integrations were not redeployed for this work.
