# Cloudflare agent/Worker consolidation — issue #203 (2026-11-09)

## Live inventory checked
Cloudflare account Workers inventory and **binding names/types only** inspected (no secret values). Current iFund Workers include:
- Advisory previews: `ifund-strategy-agent-preview`, `ifund-growth-agent-preview`.
- Outreach previews: `ifund-communications-agent-preview`, `ifund-managed-connections-agent-preview`.
- Story: `ifund-story-agent`, `ifund-story-agent-preview`.
- Operational: `ifund-workflows` (fetch+scheduled), `ifund-workforce`, `ifund-notifications`, `ifund-geocode-staging`.
- Security-sensitive: `ifund-payments`, `ifund-oauth` (D1), `ifund-email-ingress` (email handler and signing secret).
- Existing main API: `interplanetary-fund2`, `interplanetary-fund-api-migration`.
Do not modify unrelated account Workers (`onlycryptids-*`, `ring-guardian-*`, `pocketspace-*`).

## Safe proposed pairings (preview-only, never merge deployments by naming alone)

1. **Strategy + Growth** → candidate `ifund-planning-agent-preview`. Both are advisory AI/Supabase operations with aligned read/report/recommendation lifecycle. Use separately namespaced routes `/api/strategy/*` and `/api/growth/*`, independently gated by `IFUND_STRATEGY_ENABLED` and `IFUND_GROWTH_ENABLED`. Preserve each module's identity/authorization, data access, rate limits and recommendation approvals. No direct publish/send/payment powers. Existing feature PR dependency chain #211 → #213 supports coordination. This is the FIRST proposed unit to implement after owner review and route inventory.

2. **Communications drafts + Managed Connections** → possible `ifund-outreach-agent-preview` only after a permission audit. Draft/review/approval workflows and consented connections can share a UI/API surface, but **message send** and **OAuth token modification** must remain separately permission-gated modules. Existing PR chain #220 → #223. Do not combine unrestricted secrets or allow drafts to trigger sending. If least-privilege separation cannot be preserved, keep two Workers.

3. **Workflows + Workforce** → consider a single orchestration Worker only after inventorying scheduled triggers, task queue, and service bindings; fetch and scheduled handlers can coexist but existing cron and retries must remain correct. Preserve distinct public vs internal entrypoints and authorization.

4. **Story production + Story preview** are **environments of one capability**, not two tasks to merge. Keep isolated preview and production releases. Do not consolidate them into a shared deployment or consume paid AI credits.

## Must remain isolated
- `ifund-payments`: PayPal webhook verification, idempotency, financial ledger, owner-only withdrawal, 7% fee, least-privilege credentials.
- `ifund-oauth`: OAuth state, tokens and D1 binding. No combination with outreach or public campaign APIs.
- `ifund-email-ingress`: distinct `email` event handler and private signing keys. May dispatch to other Workers via authenticated service bindings, not share secrets with them.
- `interplanetary-fund2` public API / Pages routing: preserve canonical frontend/Base44 runtime until original UI preview parity is verified and owner authorizes each dependency replacement.
- `ifund-notifications`: do not fold into communications until event delivery, fanout and privacy contracts have been verified.

## Integration sequence
1. Inventory actual routes, secrets **names only**, scheduled triggers, Worker-to-Worker bindings, auth scopes, code ownership, and current preview traffic for proposed pair.
2. Build a new *preview-only* composite Worker using internal modules and route namespaces. Do not delete or rename old Workers.
3. Unit tests: module isolation, deny-by-default access, per-capability feature flags, independent error containment, no accidental sends, no payment routes, route parity.
4. Deploy to new preview endpoint; test old and composite endpoints side by side with non-production data and real browser/API checks.
5. Only after proven parity and rollback, switch **preview** routes gradually. Retain old Workers for rollback. Production change requires separate approval.
6. Avoid duplicate scheduled triggers and duplicate message sends while both versions run.
7. Consolidation is about cohesive responsibilities, not reducing Worker count at the expense of security or free-tier budget.

## Ownership and immediate action
Lead architect owns this contract on `agent/lead-architecture`; backend/integration owners implement runtime and verify preview. Do not overwrite their branches. Source UI remains `interplanetarysister/interplanetary-fund2/main` at latest observed SHA `19fdd209324bb411c2bb1cd58314b25ae31a888c`.
