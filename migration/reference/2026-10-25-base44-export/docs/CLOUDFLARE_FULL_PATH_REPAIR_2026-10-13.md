# IFund complete Cloudflare pathway repair — October 13, 2026

## Scope and non-destructive baseline
This records the two reported failures across the whole route, not merely an isolated Worker:
1. The public domain must route `/api/health`, `/api/mcp`, OAuth discovery and `/v1/admin/agents/*` through Cloudflare Worker compute.
2. IFund browser origins must pass credentialed CORS preflight without exposing privileged admin operations to anonymous or foreign origins.

Keep Base44 authoritative for existing user identity, permission checks, campaigns, donations, ledger, webhooks, and backend execution until the distinct backend migration has been proved. Do not modify the PayPal business account, create new financial ledgers, or change APK authorization in this DNS repair.

### Measured public DNS / runtime state
Read-only public DNS lookups on October 13, 2026:
- Delegated nameservers: `ns12.wixdns.net`, `ns13.wixdns.net` (Wix DNS).
- Apex A: `216.24.57.1` (the site's Render destination).
- `www` CNAME: `base44.onrender.com`.
- `https://interplanetaryfund.com/api/health`: HTTP 200 `text/html` from a Render/Base44-originated application shell, **not** the Cloudflare Worker health JSON.
- `https://www.interplanetaryfund.com/api/health`: redirects to apex; same wrong health result.
- `https://interplanetary-fund2.interplanetary-fund.workers.dev/api/health`: HTTP 200 JSON with `runtime: cloudflare-worker`.
- Direct Worker MCP: unauthenticated 401 with `x-ifund-mcp-proxy: base44` (good).
- Before repair, direct Worker admin CORS preflight with `Origin: https://interplanetaryfund.com`: 403 `Origin denied`.
- All three website/build targets checked had release marker `ifund-20261013-legal-help-paypal-mobile-parity-v4`; marker parity does **not** establish gateway readiness.

**Root cause:** The authoritative DNS is currently on Wix, not on Cloudflare. Cloudflare **Routes** declared in `wrangler.toml` do not run for requests delivered directly to a Render-origin hostname outside a Cloudflare-proxied zone. Merely redeploying the Worker cannot fix public-domain traffic. The second failure is caused by missing or incomplete `IFUND_ALLOWED_ORIGINS` runtime configuration; its allowlist is now maintained in versioned Wrangler configuration.

## Changes in the isolated repair branch
- Versioned explicit IFund origin allowlist in `wrangler.toml`, without wildcard origin matching.
- `keep_vars = true` so non-secret dashboard-configured backend endpoint variables survive Wrangler deployments; sensitive keys stay as Cloudflare secrets.
- Apex and `www` route declarations for health, MCP, admin gateway, and OAuth metadata.
- Tests for browser CORS preflight, unknown-origin denial, and anonymous admin denial.
- Deployment gate `scripts/verify-live-cloudflare-pathway.mjs`: Worker + apex + www return true health JSON, MCP carries its Worker proxy marker, legitimate origins pass preflight, anonymous admin remains denied, foreign origins remain denied, and website/Worker/Base44 release IDs match.

## Required infrastructure work — DO NOT SKIP OR GUESS
Cloudflare requires an **active Cloudflare zone with a proxied DNS record** before hostname Worker routes can intercept traffic. The current Wix DNS delegation makes those routes inoperative. Only the domain owner/authorized DNS service connection can finish this part.

1. **Inventory and back up the entire Wix authoritative DNS zone** (including all MX, SPF, DKIM, DMARC, TXT verification records, subdomains, custom redirects, and certificate/domain verification records). Public DNS sampling is not a complete zone export.
2. Inspect the actual Cloudflare account and confirm it owns/has an active zone for `interplanetaryfund.com`, with correct nameservers, sufficient DNS/Workers permissions, and exact existing Worker `interplanetary-fund2`. Do not assume that a Worker deployed under a `workers.dev` account means the custom domain is controlled by that account.
3. In the Cloudflare zone, stage matching DNS records. Keep apex origin `216.24.57.1` and `www` target `base44.onrender.com` for the transition, but configure the web A/CNAME records as **proxied** once the zone is active. Preserve email and other non-web DNS records at their appropriate proxy status. Do not switch the apex to Wix's separate static website or to a new app.
4. With the zone exported and validated, use the registrar/domain-management account to delegate to the Cloudflare nameservers assigned to that exact zone. There is no safe DNS-name-server change available through this GitHub repository alone. Nameservers propagate externally; monitor the authoritative and recursive responses. Only an authorized owner should approve this domain-wide change after staging, because DNS changes can affect the site, email, OAuth redirect URIs, and third-party callbacks.
5. Confirm the Cloudflare route bindings for **both** apex and www and the correct active Worker version. Ensure Worker `IFUND_ADMIN_VERIFY_URL`, `IFUND_AGENT_EXECUTE_URL`, `IFUND_AUDIT_URL` and secret values exist as protected backend config; never put private keys in GitHub or `VITE_` variables.
6. Run `node scripts/verify-live-cloudflare-pathway.mjs` and require success. The regular GitHub deployment workflow also runs this gate after publishing. If the Worker succeeds but the custom hostname still serves HTML for `/api/health`, **do not mark production integration completed**.
7. Separately perform a real authorized admin login + session/message/status test and a verified provider webhook/payment reconciliation test using suitable safe test procedures; HTTP 403 for anonymous users is expected, not proof of authorized execution. Confirm Wix site, Base44 app, web domain, and Android distribution against one approved release; a matching JSON marker is only one check.
8. Maintain rollback evidence (Wix DNS export, current nameservers, previous Worker version and route settings) and confirm the public site, login, callbacks, and donation/withdrawal data before declaring cutover successful. Never remove Base44 or rewrite financial data as part of this change.

## Release rule
No merge or production deployment until branch tests pass and the DNS-account cutover is explicitly authorized with a completed DNS record inventory. The pending DNS repair is an **external infrastructure requirement**, not a code-only bug. Fail the release rather than reporting success from a healthy `workers.dev` Worker alone.

See: https://developers.cloudflare.com/workers/configuration/routing/routes/ and https://developers.cloudflare.com/workers/best-practices/workers-best-practices/
