# Cloudflare resource consolidation — 2026-11-10 Pacific

## Implemented

- Cloudflare account: iFund production account; website zone `interplanetaryfund.com` remains on Free Website.
- R2 buckets: `ifund-media` and `ifund-mail-archive`; both Standard storage, managed public access disabled, no custom public domains. Do not delete or expose either bucket.
- `ifund-workflows` Cron Trigger changed from `* * * * *` to `*/15 * * * *`. Its existing scheduled workflow definitions use only quarter-hour-compatible minute offsets (0, 15, 30, 45); job logic unchanged. Invocation estimate: 1440/day -> 96/day. Runtime execution confirmation still required.
- Created and deployed `ifund-agents-consolidated-preview` from the currently deployed `ifund-planning-agent-preview` (already contains growth + strategy) and `ifund-communications-agent-preview` modules, with an explicit API-path router. Existing source Workers remain untouched for rollback.
- Preview Worker entry points: `GET /health`, `GET /api/agents/health`, `/api/agents/strategy/*`, `/api/agents/growth/*`, `/api/agents/communications/*`.
- Preview URL: `https://ifund-agents-consolidated-preview.interplanetary-fund.workers.dev/health`.
- Preview flag defaults: `IFUND_STRATEGY_ENABLED`, `IFUND_STRATEGY_AI_ENABLED`, `IFUND_GROWTH_ENABLED`, `IFUND_GROWTH_AI_ENABLED`, `IFUND_COMMUNICATIONS_ENABLED`, `IFUND_COMMUNICATIONS_AI_ENABLED`, and `IFUND_COMMUNICATIONS_SEND_ENABLED` all `disabled`. Existing Supabase URL and publishable-key binding values were copied server-side from the planning preview. No financial credentials were transferred.
- `AI` binding included; inference remains disabled via feature flags.
- Confirmed Cloudflare deployment version `1bbe062f-2a3c-4e27-9ccd-5ffabf2ab9b7`, and verified **zero production routes** to the consolidated Worker.

## Preserve / do not merge

- `ifund-payments`: separate live PayPal secrets, signature verification, webhook handler, and idempotent ledger processing. Maintain separate payment authority.
- `ifund-sandbox-broker`: isolate sandbox credentials from live payments.
- `ifund-email-ingress`: email event handler, signing secrets, and private R2 mail archive binding.
- `interplanetary-fund2` and `ifund-oauth`: preserve current auth and API compatibility until parity tests succeed.
- `ifund-notifications`: preserve existing live routes until a consolidated notification adapter is regression-tested.

## Pending validation / rollout gates

1. External GET `/health` response should return HTTP 200 and `preview:true`. The testing environment could not resolve workers.dev, so HTTP smoke testing is not verified.
2. Confirm strategy/growth and communications APIs fail closed while flags are disabled; verify method restrictions, authorization, request size checks, and CORS.
3. Configure nonfinancial agent feature flags only in preview, run end-to-end tests against the correct Supabase project, and ensure no outbound messages are sent in testing.
4. Confirm notification read/write compatibility before consolidating `ifund-notifications`.
5. Verify workflow scheduled runtime after the cron change, including hourly and quarter-hour tasks.
6. Leave production routes unchanged until tests pass. Record rollback URLs and restore prior route assignments if any regression is observed.

## Storage controls

Do not apply automatic deletion to campaign originals, private mail, donation receipts, or compliance records without a retention review. Optimize image size, upload limits, and duplicate-object handling at the application layer first. Retain the default multipart-upload abort rule. Supabase is the structured record store; R2 is object storage.
