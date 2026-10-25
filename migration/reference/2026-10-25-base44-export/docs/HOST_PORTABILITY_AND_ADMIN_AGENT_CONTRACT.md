# Interplanetary Fund host portability and admin-agent contract

Interplanetary Fund is one product regardless of which approved host serves the frontend.

## Non-negotiable data contract

Until a replacement backend has a verified bidirectional replication layer, every hosted frontend MUST use the same authoritative Base44 application/data plane:

- `VITE_BASE44_APP_ID` = the same Interplanetary Fund app ID on every host.
- `VITE_BASE44_APP_BASE_URL` = the same authoritative Base44 app/backend URL on every host.
- No host may create an independent campaign, donation, user, connection, agent-memory, or admin-action database and call it synchronized.
- A future backend migration must use explicit IDs, idempotent change events, conflict handling, replay/checkpoints, and reconciliation before it may become writable.

This prevents split-brain state while free hosting is introduced.\n\n## Degraded-provider and billing rule\n\nA build MUST NOT fail solely because a paid provider capability is unavailable, suspended, quota-limited, or inaccessible due to the account's current billing state. This includes Base44 two-way GitHub sync. Such conditions are runtime/deployment capability states, not source-integrity failures.\n\nWhen a paid capability is unavailable:\n\n- continue building and testing all locally verifiable product code;\n- report the affected capability as `degraded`, `unavailable`, or `manual-sync-required`;\n- preserve queued/replayable synchronization intent where supported;\n- never report unavailable synchronization as completed;\n- do not erase or fork authoritative product data merely to make the status appear healthy.\n\nBuild-blocking failures remain appropriate for source errors, compilation/type failures, security/authorization regressions, schema/contract corruption, financial-integrity failures, or deterministic tests that fail independently of provider billing/availability.

## MCP host portability

Approved non-Base44 frontends expose a host-relative MCP entrypoint at `/api/mcp`. Cloudflare must run Worker compute before static assets for MCP and OAuth discovery/consent routes and proxy those requests to the canonical Base44 app origin. Base44 remains authoritative for MCP tool definitions, OAuth grants, user identity, and permission enforcement.

The Cloudflare Worker must not duplicate or weaken Base44 MCP authorization. It may forward the original Authorization/cookie context and add routing metadata, but it must not manufacture user identity or elevate permissions.

## Admin development-agent gateway

The browser MUST NOT contain the admin key. The supplied admin key belongs only in the chosen host's protected server-side secret store as `IFUND_ADMIN_AGENT_KEY`.

The frontend receives only `VITE_ADMIN_AGENT_API_URL`, which points to the server-side gateway. The gateway contract is:

- `POST /v1/admin/agents/session` — authenticate the signed-in platform administrator plus the submitted admin key; return an opaque short-lived session ID.
- `POST /v1/admin/agents/message` — accept that opaque session plus a target approved builder/admin development agent and message.
- Re-check platform admin role server-side on every consequential action.
- Compare the key server-side using constant-time comparison. Never return, log, persist to agent memory, or place the raw key in an audit record.
- Rate-limit failed key attempts and expire sessions.
- Record agent identity, requesting admin user ID, requested action, result/status, timestamps, and non-secret evidence reference.
- Development agents may diagnose/build/repair only through configured tools. Payments, withdrawals, ownership, credentials, provider authorization, and other independently protected operations retain their own authorization controls.

## Host configuration

Each approved host receives the same public runtime values and its own protected secrets:

```
VITE_BASE44_APP_ID=<same canonical app id>
VITE_BASE44_APP_BASE_URL=<same canonical backend url>
VITE_ADMIN_AGENT_API_URL=<that host's admin gateway url>
IFUND_BASE44_ORIGIN=https://interplanetaryfund.base44.app
IFUND_ADMIN_AGENT_KEY=<protected server secret; never VITE_ prefixed>
```

The admin gateway may run on a different free host from the static frontend as long as authenticated CORS/origin policy restricts it to approved Interplanetary Fund origins and all deployments share the canonical data plane.
