# Connection Discovery Agent — source-parity implementation contract (2026-11-09)

## Ownership and release scope
Canonical definition: `interplanetarysister/interplanetary-fund2@19fdd209324bb411c2bb1cd58314b25ae31a888c/base44/agents/connection_discovery_agent.jsonc`. This is the sixth specialist in `docs/agents/sequential-build-ledger.json` on `feature/managed-connections-agent-20261105`, after Managed Connections and before Outreach. The source `host/workforce/worker.js` is a **read-only disabled execution catalog**, not a ready agent runtime.

Lead architecture owns this contract only; implementer owns code, migration, tests, and Cloudflare preview on its own branch. Preserve the original Base44-connected frontend and its working integrations. Do not replace SDK/runtime dependencies until the user explicitly authorizes the *whole* functional unit. Do not connect the new Worker to production or replace existing preview bindings before tested parity.

## API boundary and evidence
A future Cloudflare Worker must provide authenticated, owner-scoped, read-only capability lookups and an administrator-controlled research proposal workflow. It must never grant connection access, credentials, provider permissions, publishing, payments, or withdrawal powers based on a research record. Proposed route families: `GET /api/agents/connection-discovery/capabilities` (scoped read), `POST /api/agents/connection-discovery/research-drafts` (draft only), `POST /api/agents/connection-discovery/review` (verified admin review); these are **proposals, not deployed routes**. Distinguish provider capability from IFund implementation status and from verified successful live execution.

Research evidence must capture provider ID from the canonical catalog, official evidence URL, observed date, supported/unsupported/manual actions, connection strategy, OAuth availability, user consent and verification requirements, webhook/poll support, direct-publish evidence, manual-share evidence, status, and provenance. Use `verified`, `inferred`, `unknown`, or `unsupported` explicitly. A provider's docs alone cannot set `direct_publish_verified=true`; require an authorized real provider test and a non-secret receipt. Do not fabricate provider capabilities or infer a working adapter from a catalog entry.

## Security and integration
- Authenticated member requests see only their authorized provider catalog and own connections; privileged research approval must be server-side role-checked, not user-editable metadata.
- Discovery has no permission to access provider refresh/access tokens or raw secrets, to invoke Managed Connections consent actions, or to launch browser account creation. Only the Managed Connections boundary may execute approved connection actions.
- External fundraising synchronization is **human-triggered only**: no periodic polling, login/page-load sync, or unsolicited agent sync. Financial settlement webhooks are a distinct verified-payment path.
- Use existing Supabase `public.ifund_connections`, `public.ifund_platform_connection_recipe`, and `public.ifund_admin_api_connection_intake` only after inspecting their schemas, RLS, grants, and actual data contracts. They are not proof that the original Base44 `FundraisingProviderCapability` registry has been migrated. Additive migrations only; no unreviewed schema replacement or public grants.
- No provider passwords, tokens, OAuth secrets, service-role keys, or raw personal information in GitHub, logs, research output, or agent memory. Secrets remain in server-side Cloudflare/Supabase secret storage.
- Return `401` for unauthenticated private routes, `403` for forbidden owner/admin actions, and `503` for unavailable adapters; never pretend an operation succeeded.

## Preview acceptance tests before wiring
1. Compare all original Discovery tool configs, instructions, and provider capability fields with the actual implementation; inventory each unsupported tool explicitly.
2. Prove anonymous denial and cross-account RLS isolation with two real authenticated test identities, including a non-admin attempt to approve research.
3. Validate `verified` requires an official URL and timestamp; `direct_publish_verified` requires a real receipt; stale/inferred records never claim supported IFund execution.
4. Verify provider consent cannot be escalated via Discovery, and no unapproved external posting, OAuth action, polling, or financial action occurs.
5. Test malformed provider IDs, request size limits, error handling, duplicate/idempotent proposals, no secrets in logs, and failure when Supabase or a provider is unavailable.
6. Run repository unit tests and both builds; deploy a new isolated Cloudflare preview Worker; probe health and authenticated/unauthenticated routes; then visually test original frontend on mobile and Base44 connection. Record actual version, URL, test receipts, and rollback plan.
7. Keep the original Managed Connections Worker and Base44 implementation available until authorized whole-unit cutover and explicit production approval.

## Verified inventory and gaps (2026-11-09)
Supabase project `ssibsfmtodgximseeqsv` reported `ACTIVE_HEALTHY`. SQL catalog shows the three existing connection-related tables named above; no claim is made about their columns, RLS, or data until inspected. Cloudflare Pages preview currently binds `IFUND_CONNECTIONS_AGENT` to `ifund-managed-connections-agent-preview`; no Connection Discovery binding was observed in the Pages preview binding inventory. Existing source branch `feature/managed-connections-agent-20261105` lists Discovery as blocked by previous agent. This contract is **not** an agent deployment, and should not advance the ledger without a verified runtime.
