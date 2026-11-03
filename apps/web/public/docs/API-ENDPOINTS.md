# Interplanetary Fund — API endpoint catalog

**Source branch:** `feature/ifund-full-frontend-20261103`  
**Source of truth:** `docs/migration/INDEPENDENT_API_ROUTE_MATRIX.md`  
**Status:** source-level preview API inventory. The matrix says these routes require `MIGRATION_API_PREVIEW=enabled` and are **not deployed**. This catalog does not claim live availability.

## Implemented in preview Worker source (15 routes)

| Method | Path | Access | Intended behavior |
|---|---|---|---|
| GET | `/api/health` | Public | Health only; reports `production:false` |
| GET | `/api/community/feed` | Public | Bounded recent public posts |
| POST | `/api/community/posts` | Authenticated | Create own post; body length 1–2000 characters |
| DELETE | `/api/community/posts/{uuid}` | Authenticated owner | Delete own post |
| GET | `/api/campaigns/public` | Public | Bounded recent published campaigns |
| GET | `/api/campaigns/{uuid}` | Public | Active campaign details only |
| GET | `/api/campaigns/mine` | Authenticated | List own campaigns |
| GET | `/api/campaigns/{uuid}/draft` | Authenticated owner | Read own draft |
| POST | `/api/campaigns` | Authenticated | Create owner draft / validated publish |
| PATCH | `/api/campaigns/{uuid}` | Authenticated owner | Update own campaign |
| DELETE | `/api/campaigns/{uuid}` | Authenticated owner | Delete own draft only |
| GET | `/api/account/me` | Authenticated | Supabase-verified account UUID; no role assertion |
| GET | `/api/account/profile` | Authenticated | Read own profile |
| PUT | `/api/account/profile` | Authenticated | Update own handle/display name only |
| GET | `/api/account/connections` | Authenticated | Read own provider connection statuses; does not connect providers |

Private routes validate the bearer token against Supabase Auth and forward the user JWT to PostgREST so database RLS remains the ownership boundary. The preview matrix specifies HTTPS `SUPABASE_URL`, a Supabase publishable key, and `MIGRATION_API_PREVIEW=enabled` as prerequisites.

## Not implemented in this Worker route matrix

Unimplemented routes fail closed (404); unsupported methods on known route families return 405. The matrix explicitly excludes:

- PayPal checkout, donations, settlement, withdrawals and ledger
- Admin role changes
- External social OAuth callbacks and connection flows
- Media upload
- Historical Base44 MCP endpoints
- Remaining legacy backend function parity (184 source entrypoints overall)

The deployed legacy Cloudflare Worker is separate from this preview Worker source and still has legacy Base44 proxy routes. Do not confuse those live legacy routes with this independent API.

## Request/response contracts

The source route matrix verifies route, method, scope and behavior, but does not publish complete JSON request/response schemas for every operation. This documentation therefore does not invent field-level payload contracts. See the OpenAPI file for the route/method inventory; consult the Worker implementation and tests before building a client against detailed payloads.

## Production gate

Keep `MIGRATION_API_PREVIEW`, `VITE_IFUND_CAMPAIGN_API` and `VITE_IFUND_COMMUNITY_API` disabled until the Supabase project, RLS, cross-account behavior, Pages/Worker dispatch, data reconciliation and remaining function/provider parity have passed their documented gates. No financial or external-provider route is enabled by this catalog.
