# Owner actions

Tasks only the owner (M) can do. Part of the migration plan in #137. Agents: add new owner-only tasks here; never put secret values in this file or anywhere in the repo.

## 1. Secret transfer (Base44 / GitHub / providers -> Supabase + Cloudflare + GitHub)

### Rules
- Secret values never go into chat (ChatGPT, Town, or anywhere else), commits, PR text, logs, or `VITE_*` variables.
- Base44 `secrets list` returns names only, and GitHub secrets cannot be read back. Values come from each provider's dashboard, or are regenerated.
- Rotate any value that has ever been pasted into a chat or log, after the new consumer is verified.
- Target Supabase project: `ssibsfmtodgximseeqsv` (new). Do not repoint live Pages/Workers from `tzehxfikoslihnclhxuz` until the cutover gate.

### Recommended path: one secrets manager that syncs everywhere (Infisical)
- [ ] Create an Infisical project `interplanetary-fund` with `staging` and `production` environments.
- [ ] Enter each value once in Infisical, copied straight from the provider dashboard.
- [ ] Add App Connections: GitHub, Cloudflare (scoped API token), Supabase (access token).
- [ ] Create Secret Syncs:
  - [ ] GitHub, scope **Organization** (account-wide; requires the repos to live in a GitHub org, see step 2)
  - [ ] Cloudflare Workers (PayPal Worker script), variable type **Secret**
  - [ ] Supabase project `ssibsfmtodgximseeqsv` (Edge Function secrets)
- [ ] Give agents an Infisical machine identity limited to triggering syncs and listing names, not reading values.

### 2. Account-level GitHub secrets
Personal GitHub accounts have no account-wide Actions secrets; organizations do.
- [ ] Create a free GitHub organization (e.g. `interplanetary-fund`).
- [ ] Do not transfer, push to, or modify the read-only source `interplanetarysister/interplanetary-fund2`; this project must remain untouched during migration. If an organization is voluntarily adopted later, plan the target-repo transfer independently with rollback and connector review.
- [ ] Only if a future target-repo transfer is explicitly approved, reconnect the necessary supported integrations. Do not disconnect working providers during cutover preparation.
- [ ] Store shared secrets as **organization secrets** with selected-repo access.

### 3. Secret destination checklist

| Secret | Value source | Destination |
|---|---|---|
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE` | PayPal Developer dashboard (sandbox first) | Cloudflare PayPal Worker; GitHub org |
| `PAYPAL_WEBHOOK_ID` | Created when the webhook is registered (not done) | Cloudflare PayPal Worker |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (`sb_secret_...`) | Supabase `ssibsfmtodgximseeqsv` > API keys | Cloudflare Worker; GitHub org |
| `Browserbase_api_token` | Browserbase dashboard | Supabase Edge secrets; GitHub org |
| `Buffer_client_id`, `Buffer_client_secret`, `Buffer_api_key`, `Buffer_app_id` | Buffer developer settings | Supabase Edge secrets, only if Buffer is kept |
| `APP_USER_CONNECTOR_EVENTBRITE_ID` | Eventbrite | Supabase Edge secrets |
| `Cloudflare_api_token` | Cloudflare dashboard, new scoped token | GitHub org only (deploy automation) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe dashboard | Hold until Stripe is confirmed kept |
| 8 Convex secrets | n/a | Do not move; revoke after Convex is retired |

Source inventory: `docs/migration/SECRET_DESTINATIONS.md` (PR #138).

### Manual fallback (no secrets manager), run locally
- Supabase: `supabase secrets set --project-ref ssibsfmtodgximseeqsv --env-file ./secrets.local.env` (file never committed; delete after).
- Cloudflare: `wrangler versions secret put NAME --name <worker>` (staged, not deployed). Avoid plain `wrangler secret put`, which deploys immediately.
- GitHub org: `gh secret set NAME --org <org> --repos "InterplanetaryFund,interplanetary-fund2"`.

### Verify
- [ ] Names (not values) present in each destination: `gh secret list --org <org>`, `supabase secrets list --project-ref ssibsfmtodgximseeqsv`, `wrangler secret list --name <worker>`.
- [ ] PayPal sandbox webhook test passes before any live credentials.
- [ ] Old values rotated where previously exposed.

## 2. Other open owner items
- [ ] Check whether interplanetaryfund.com currently serves the new, incomplete Cloudflare Pages app (PR #148 says apex/www are proxied to Pages).
- [ ] Check `migration/reference/2026-10-25-base44-export/.npmrc` in PR #147 for tokens before that PR goes further.
- [ ] Comment `@coderabbitai resume` on PR #138.
