# Portable admin gateway and MCP proxy deployment

This worker is the server boundary used by non-Base44 Interplanetary Fund frontends for protected development-agent access and for the app's public MCP entrypoint.

## MCP routing

Cloudflare serves the React/Vite application, while Base44 remains the authoritative data plane and MCP implementation. The Worker proxies only the MCP/OAuth paths required by compatible AI clients:

- `/api/mcp` and `/api/mcp/*`
- `/api/apps/*/mcp` and `/api/apps/*/mcp/*`
- OAuth discovery under `/.well-known/oauth-*`

The production hostname remains on the existing Base44 origin for ordinary application traffic. Cloudflare path routes invoke this Worker only for the Worker-owned API surfaces: health, MCP/OAuth discovery, and the protected admin-agent gateway. The public MCP URL therefore remains host-relative:

`https://interplanetaryfund.com/api/mcp`

The Worker also exposes an unauthenticated, non-secret liveness probe at `https://interplanetaryfund.com/api/health`. A healthy response identifies the runtime as `cloudflare-worker`; returning the SPA shell is a deployment failure.

MCP requests are forwarded to `IFUND_BASE44_ORIGIN`, currently `https://interplanetaryfund.base44.app`. The Worker does not duplicate Base44 authorization or tool permission logic; it preserves the canonical OAuth/user-permission boundary.

## Admin development-agent gateway

Configure these runtime values on the chosen free host:

- `IFUND_BASE44_ORIGIN`: canonical Base44 app origin used for the MCP proxy.
- `IFUND_ALLOWED_ORIGINS`: comma-separated approved Interplanetary Fund frontend origins.
- `IFUND_ADMIN_VERIFY_URL`: canonical Base44 `verifyAdminGateway` function URL.
- `IFUND_AGENT_EXECUTE_URL`: canonical Base44 `executeAdminAgentRequest` function URL.
- `IFUND_AUDIT_URL`: canonical Base44 `auditAdminAgentGateway` function URL.
- `IFUND_ADMIN_AGENT_KEY`: protected admin development key; secret store only.
- `IFUND_SERVICE_TOKEN`: optional protected service credential for non-user service calls; it is not the identity used to execute an administrator's development-agent request.

The frontend gets only the deployed gateway URL as `VITE_ADMIN_AGENT_API_URL`. For protected admin requests it also forwards the already-authenticated Base44 bearer credential. The Worker re-verifies that credential with `verifyAdminGateway`, requires canonical super-admin status, and forwards the same user credential to `executeAdminAgentRequest` and the audit boundary. The admin key remains an additional gate and is never exposed as frontend configuration.

Agent execution is asynchronous. `POST /v1/admin/agents/message` starts the approved Base44 agent conversation and returns an activity ID; `POST /v1/admin/agents/status` resolves that activity to the agent conversation and reports `processing`, `waiting_for_user_input`, `completed`, or `failed`. The corresponding `AgentActivity` record remains the durable audit trail.

A provider/billing outage is reported as degraded. It does not make source builds fail, and the gateway must never report an unexecuted request as completed.


## Campaign creation inference migration

The existing gateway now owns the dormant `POST /api/v1/campaign-assistant` route in `campaign-assistant.js`. It supports structured title/summary choices, story generation/revision, and campaign-derived images. The client switch is `VITE_CAMPAIGN_ASSISTANT_URL` (HTTPS only). Without it, existing Base44 inference remains authoritative. Once configured, external errors never fall back to Base44 generation or silently consume Base44 credits.

Image requests include campaign title, summary, story, category, funding goal and AI profile via the existing context builder. IFund's existing art prompt includes cyberpunk/steampunk/interstellar/space-comic and futuristic-mystical-nature motifs. Fictional representative beneficiaries/supporters are encouraged when relevant, without presenting them as actual identified people. `cover_image_is_ai` persists an AI-generated illustration caption through drafts and public campaign detail. Browser finishing and existing server image policy continue handling watermark entitlements.

Activation requirements (not performed):
1. Confirm account/model eligibility and owner-approved daily quota allocation. Free inference is limited usage, not unlimited. Never enable paid overflow automatically.
2. Bind Workers AI as `AI`; bind a rate limiter as `CAMPAIGN_AI_LIMITER` (suggested initial per-user limit: 3 requests per 60 seconds). Deploy with `IFUND_CAMPAIGN_AI_ENABLED=disabled` first.
3. Add the route for both production hostnames if using the custom domain; `run_worker_first` already lists it. Verify existing live settings before deployment so unrelated bindings, secrets, routes, and assets are preserved.
4. Verify model terms: current candidates are `@cf/google/gemma-4-26b-a4b-it` and `@cf/black-forest-labs/flux-1-schnell`. Source documentation checked 2026-10-22. Gemma 4 license link resolves to Apache-2.0 (https://ai.google.dev/gemma/apache_2). FLUX hosted terms inspected at https://bfl.ai/legal/terms-of-service; hosted-service/model-specific terms remain applicable. Do not treat public model availability as unrestricted output rights or automatic licensing approval.
5. Run the deterministic gateway test, then an owner-approved bounded live text/image trial. Only after quality and auth/limits pass should the external endpoint/client switch be enabled for members.

Remaining Base44 dependencies are explicit: user/session and feature verification, campaign persistence, uploads and watermark-entitlement account reads. This is inference migration, not independent hosting/auth/storage. Rollback: clear the client endpoint to return to the prior provider, and disable `IFUND_CAMPAIGN_AI_ENABLED` to stop Workers AI use. No schema deletion is needed.

Verification: `node scripts/test-campaign-assistant-gateway.mjs`, existing `test-cloudflare-mcp-proxy.mjs`, and `test-generate-campaign-cover.mjs` passed with mocked inference. Changed client JS/JSX lint passed. No provider inference, paid action, new infrastructure, or live deployment executed. Live end-to-end quality remains unverified.

Reuse discovery: retained existing gateway and pure prompt/context helpers; no new provider SDK dependencies. Evaluated Cloudflare Workers SDK source/license at https://github.com/cloudflare/workers-sdk/blob/main/LICENSE-APACHE; using native AI binding avoids importing that SDK. New campaign module is scoped to member generation and kept separate from administrator authentication/action code.

Account preflight: connected Cloudflare access can list workers, including the existing interplanetary-fund2 worker. Account subscription inspection returned 403 because the OAuth connection lacks Billing Read; no subscription was changed and paid/free plan eligibility remains unverified. Before activating inference, verify account plan/free allowance through a permitted account read or owner-provided plan confirmation. Proposed bounded trial: one structured-text request and one 4-step image request, estimated below 1,000 neurons, $0 paid budget. This trial has NOT been executed or approved.
