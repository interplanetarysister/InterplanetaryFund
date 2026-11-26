# iFund OAuth readiness reconciliation — 2026-11-26

Owner-authorized diagnostic and source repair for external connections. This record contains binding **names and booleans only**; no token, key, JWT, refresh token or secret value was read out, printed, copied into a file, or committed.

## Live runtime finding

A verified owner administrator session was refreshed in memory only, then used against the canonical production origin with a browser-like `User-Agent` and no credential output.

| Probe | Result |
| --- | --- |
| `GET /api/oauth/status` | `200`; value-free diagnostics returned |
| `GET /api/oauth/readiness` | `200`; `enabled: true`, all provider booleans `false` |
| `GET /api/oauth/google/start` | `503 {"error":"Provider connections are not configured."}` |
| `GET /api/oauth/github/start` | `503 {"error":"Provider connections are not configured."}` |

Admin diagnostic booleans:

- `OAUTH_API_ENABLED`: configured
- `OAUTH_FRONTEND_ORIGINS`: configured
- `SUPABASE_URL`: configured
- `SUPABASE_PUBLISHABLE_KEY`: configured
- `SUPABASE_SECRET_KEY`: **not configured**
- `OAUTH_ENCRYPTION_KEY`: **not configured**
- `storage_ready`: `false`

**Root cause:** the shared runtime gate `oauthRuntimeReady()` fails on the production Pages Function because `SUPABASE_SECRET_KEY` and `OAUTH_ENCRYPTION_KEY` are absent from that runtime. This is not evidence that provider client apps are registered, approved, consented or capable of publishing/fundraising. The 2026-11-18 binding audit is a historical snapshot and must not be used to assert the present binding state.

## Source repair

`worker/oauth.js` now returns a member-safe readiness contract:

- `runtime_ready` uses the same six-binding gate as the authorization routes.
- `providers[name]` is true only when provider configuration **and** the shared gateway are ready.
- `provider_states[name]` distinguishes `not_configured`, `unavailable` and `ready` without leaking binding values or admin diagnostics.

`apps/web/src/pages/Connections.jsx` consumes that contract:

- A configured provider during a gateway outage is reported as `unavailable`, not "not offered".
- A verified saved connection is `authorized`; an errored grant is `needs_reconnect`.
- Signed-out, unavailable, not-configured and reconnect states have distinct member-facing notices.
- Disconnect remains ungated so saved access can be revoked during an outage.
- `connectionCapabilityReadiness` continues to separate identity connection from verified publishing authority.

Admin-only `/api/oauth/status` remains the only route exposing runtime/storage arrays. Its values are boolean diagnostics only.

## Supabase reconciliation

Read-only Supabase CLI queries against the canonical project `ssibsfmtodgximseeqsv` found:

- Migration version `20261116121653`, name `ifund_member_connections_hub_20261113`, is applied. The repo file remains named `20261113080000_ifund_member_connections_hub.sql`; this is a filename/version drift, not a missing schema.
- OAuth-relevant migrations `20261105115633`, `20261109131024`, `20261111082752`, `20261111091708`, `20261112152217`, `20261116121653`, `20261117005336` and later connection-consent migrations are present.
- Tables `ifund_connections`, `ifund_provider_tokens`, `ifund_oauth_transactions`, `ifund_member_public_links`, `ifund_member_share_choices` and `ifund_provider_connection_events` exist with the expected core columns.
- No corrective migration was applied and no Supabase data was mutated.

## PayPal and Stitch reconciliation

- `integrations/paypal-orders-client.mjs` remains an unwired APIMatic artifact. A regression test asserts that only its own test imports it. The native payment Worker and sandbox Pages Function already perform the same read-only order lookup; adding a second live transport would bypass verified-capture, webhook and ledger gates.
- `.stitch` remains an additive, source-only design-reference kit. No Stitch upload, hosted integration, provider grant or `/connections` capture was created. Cosmic Geometry design rules remain reference material, not proof of a live authorization or publishing capability.

## Validation

| Check | Result |
| --- | --- |
| Focused OAuth and readiness tests | 59 pass, 0 fail |
| Root test suite | 1,158 pass, 0 fail |
| Web test suite | 1,351 pass, 0 fail |
| `npm run build` in `apps/web` | succeeded; only pre-existing chunk-size warning |
| `git diff --check` | clean |

Two unchanged web tests had Windows CRLF-only regex assumptions; their assertions were made CRLF-tolerant without changing payment or media behavior.

## Infrastructure state

No Cloudflare, Supabase, GitHub provider app, PayPal or Stitch mutation was performed. No commit, push, git-action trigger or Cloudflare deployment was made. Deploy remains blocked until the owner authorizes and supplies/verifies the two missing Pages runtime bindings, then a preview smoke test and an explicit production release authorization are completed.
