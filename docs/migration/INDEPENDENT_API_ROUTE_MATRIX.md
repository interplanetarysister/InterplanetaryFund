# Independent IFund preview API route matrix

**Scope:** Code-only Cloudflare Worker for the four migrated public preview tables. Authority: issue #137. This is **not the full 184-function Base44 port** or a payment cutover.

All entries below require `MIGRATION_API_PREVIEW=enabled`, a valid HTTPS `SUPABASE_URL`, and a Supabase **publishable** key. User/private routes validate the request bearer against Supabase Auth and forward that JWT to PostgREST so database RLS enforces row ownership. Invalid/oversized JSON is rejected with a streaming body limit. These endpoints are not deployed.

| Method | Route | Scope | Status |
|---|---|---|---|
| GET | `/api/health` | Health only; reports `production:false` | Code + synthetic test |
| GET | `/api/community/feed` | Public bounded 30 recent posts | Code + synthetic test |
| POST | `/api/community/posts` | Authenticated owner post, 1–2000 characters | Code + synthetic test |
| DELETE | `/api/community/posts/:uuid` | Owner-only post deletion | Code + synthetic test |
| GET | `/api/campaigns/public` | 30 recently published campaigns | Code + synthetic test |
| GET | `/api/campaigns/:uuid` | Public active campaign details only | Code + synthetic test |
| GET | `/api/campaigns/mine` | Authenticated owner campaign list | Code + synthetic test |
| GET | `/api/campaigns/:uuid/draft` | Authenticated owner draft | Code + synthetic test |
| POST | `/api/campaigns` | Owner draft creation / validated publish | Code + synthetic test |
| PATCH | `/api/campaigns/:uuid` | Owner-scoped campaign content update | Code + synthetic test |
| DELETE | `/api/campaigns/:uuid` | Owner **draft only** deletion; published records are protected | Code + synthetic test |
| GET | `/api/account/me` | Supabase-verified account UUID, no role assertions | Code + synthetic test |
| GET | `/api/account/profile` | Authenticated own profile | Code + synthetic test |
| PUT | `/api/account/profile` | Authenticated own profile handle/display name only | Code + synthetic test |
| GET | `/api/account/connections` | Read owner provider statuses; never mark a provider connected | Code + synthetic test |

**Fail-closed routes:** All unimplemented endpoints, including PayPal and financial checkout/settlement, withdrawal, ledger, admin role changes, external social OAuth, media upload, and historical Base44 MCP endpoints, return 404. Unsupported methods return 405 on known endpoint families. No production Base44 fallback exists in this new Worker source; **the deployed legacy Cloudflare Worker is separate and still has Base44 proxy routes**.

## Prerequisites to go live

1. Merge phase PRs in the authorized order after addressing outstanding review changes and CI checks. This document is not permission to bypass reviews.
2. Confirm Supabase project `ssibsfmtodgximseeqsv`, correct RLS and column-level grants, at least two distinct authenticated test accounts, and cross-owner denied read/write/delete tests.
3. Reconcile source ownership, campaigns, posts and media before enabling live UI routes.
4. Confirm Cloudflare Worker route dispatch and Pages same-origin API binding in an isolated, nonproduction route.
5. Leave `VITE_IFUND_CAMPAIGN_API`, `VITE_IFUND_COMMUNITY_API` and `MIGRATION_API_PREVIEW` **disabled** until prerequisites pass.
6. Restore or independently port the remaining **184 entrypoints** (or explicitly retire each) in independent PRs, with financial/webhook/provider routes verified against actual provider sandboxes before any live cutover.
