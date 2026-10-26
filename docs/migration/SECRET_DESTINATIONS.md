# Base44 secret-name handoff — source-to-target inventory (2026-10-25)

Authority: [migration issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137). **Review-only Phase 1 inventory, not a live secret migration.**

## Evidence and limits
- Owner successfully authenticated to Base44 CLI as the authorized owner and ran `npx base44 secrets list --app-id ...`. The owner supplied **20 names** in chat. **No secret values were supplied, read, transferred or committed.**
- Read-only GitHub code searches against `interplanetarysister/interplanetary-fund2` `main` found the static references below. A missing literal reference is not proof of a secret's disuse; indirect references, CLI use and dashboard configuration remain unverified.
- Cloudflare account `c95db4f2c901f32776471b85f1eda15d` was inspected **read-only** using the Workers secret-name listing: `interplanetary-fund2` and `ifund-oauth` each showed **0 Worker secret bindings**; `ifund-email-ingress` showed **3 unrelated email secrets**. No secret values were exposed. This does not include Pages project environment variables or other Workers.
- There are two active Supabase projects: earlier `tzehxfikoslihnclhxuz` and owner-designated replacement `ssibsfmtodgximseeqsv` (see draft PR #148). **Do not silently switch the deployed Worker/Pages to the newer database.**
- PayPal platform-support callback code exists in unmerged [PR #145](https://github.com/interplanetarysister/InterplanetaryFund/pull/145). It is not a verified live payment integration, nor does it implement campaign-owner withdrawals.

## Handoff matrix

| Legacy Base44 secret names | Target and handling | Static source evidence / classification |
| --- | --- | --- |
| `PAYPAL_MODE` | Server runtime configuration (sandbox first; later live after proof), not a frontend variable | Present in PayPal checkout/config functions |
| `PAYPAL_CLIENT_ID` | PayPal Worker or Edge Function server binding (depending on actual handler) | `base44/shared/paypal.ts`, PayPal config functions |
| `PAYPAL_CLIENT_SECRET` | Server-side **secret** only; rotate/provision through PayPal dashboard | Same PayPal shared/config code |
| `Buffer_client_id` | Server-side Buffer OAuth integration configuration, only if ported | `base44/functions/getBufferReadiness/entry.ts` |
| `Buffer_client_secret` | Server-side **secret**, conditional on Buffer feature | Buffer readiness handler |
| `Buffer_app_id` | Confirm role before copying; no matching literal reference found | UNKNOWN |
| `Buffer_api_key` | Server-side **secret**, conditional on Buffer feature | Buffer readiness handler |
| `APP_USER_CONNECTOR_EVENTBRITE_ID` | Eventbrite connector configuration; no token implied by ID | `base44/shared/connectionVerification.ts` |
| `Cloudflare_api_token` | **Deployment automation only** (scoped GitHub Actions/CI secret if needed), not client or application Worker | Source workflow `.github/workflows/deploy-cloudflare.yml` and integration-health code |
| `Browserbase_api_token` | Server-side **secret**, only when Browserbase automation is ported | `base44/shared/browserbaseSecrets.ts` |
| `Convex_deploy_key`, `Convex_auth_token`, `CONVEX_AUTH_TOKEN` | **Retirement candidates only**; do not move to new runtime; invalidate after dependency/consumer audit | No exact literal references in source main code search |
| `Convex_team_token`, `Convex_narwahl_develop`, `Convex_query_develop`, `Convex_query_production` | **Retirement candidates only**; protect current use until the related Convex tooling is retired | No exact literal references in source main code search |
| `8297e9e3c88741f8_convexteamid` | Convex metadata/identifier; **not** a valid shell environment-variable name; do not export blindly | No verified target consumer |
| `STRIPE_SECRET_KEY` | Payment service **secret**, hold/disable until active Stripe dependency is confirmed | 10 source files including `base44/functions/stripeWebhook/entry.ts` |
| `STRIPE_WEBHOOK_SECRET` | Payment webhook signature verification secret if Stripe retained | 8 source files including `stripeWebhook/entry.ts` |

**Count:** PayPal 3 + Buffer 4 + Eventbrite 1 + Cloudflare 1 + Browserbase 1 + Convex 8 + Stripe 2 = **20** Base44 secret names.

## Additional credentials required by the proposed PayPal Worker (not in the Base44 list)

- `PAYPAL_WEBHOOK_ID` — PayPal dashboard webhook registration ID; **not verified/created**.
- `SUPABASE_URL` — backend URL of the specifically selected Supabase destination.
- `SUPABASE_SECRET_KEY` — recommended new `sb_secret_...` key for server-side RPC; alternatively a legacy `SUPABASE_SERVICE_ROLE_KEY` JWT, if still needed. **Never put either in `VITE_*`, `.env.example` values, a public repo, browser requests or logs.**
- Modern `sb_secret_...` keys are **not JWTs**. Use the `apikey` header, not `Authorization: Bearer`. Payment PR #145 has a code fix and unit tests for new versus legacy keys. See [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).

## Safe execution sequence (requires deployment owner gate)
1. Confirm the final runtime for **each** secret-using handler. PayPal planned on a separate Worker; do not place payment credentials on the existing Base44-proxy Worker.
2. Verify chosen Supabase project, PayPal REST-app merchant/business ownership, approved PayPal webhook ID, URL, sandbox mode, and whether hosted PayPal links actually emit expected capture events.
3. Provision or rotate provider credentials **directly at their source into destination secret stores** (Cloudflare Worker secret bindings, Supabase Edge secrets, and GitHub Actions secrets where appropriate). Never log the values, commit a `.dev.vars` file or ask for values in chat. Base44 `secrets list` is a name list, not a values export.
4. Cloudflare `wrangler secret put` **deploys immediately**. For staged Worker versions use `wrangler versions secret put <NAME> --name <WORKER>`, which creates an undeployed version, after verifying the target Worker name. No secret commands have been run in this audit. [Cloudflare reference](https://developers.cloudflare.com/workers/configuration/secrets/).
5. Test provider signature, wrong/duplicate event handling, ledger idempotency, refund/reversal, least-privilege RPC, cross-account RLS and read-only configuration presence; never simulate a real payment as proof of production readiness.
6. Rotate any credential already exposed in chat or public logs, after the new consumer has been verified; revoke old Convex/Stripe credentials only after the dependent feature is proven unused or replaced.

## Blocking facts
- Actual Base44 secret **values** and rotations: not exported; source and destination access unverified.
- Proposed PayPal webhook ID, merchant ownership and hosted-link event behavior: unknown.
- PayPal withdrawals, optional contribution split, subscriptions, donor ledgers, campaign support: **not covered** by platform-support PR #145.
- Cloudflare Pages runtime bindings, final new Worker identity, and final Supabase project configuration: not verified.
- No production cutover, database changes, credential binding, GitHub branch merge, DNS change or PayPal-provider mutation performed during this inventory.
