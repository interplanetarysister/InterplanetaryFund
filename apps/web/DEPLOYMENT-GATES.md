# IFund independent web deployment verification

## Source and production are not equivalent yet
- Source branch: `migration/public-site-port`, frontend root: `apps/web`.
- Existing Cloudflare Pages project: `interplanetaryfund-migration`.
- Current live production branch (verified): `migration/phase7-offline-cutover-gate`.
- Current Cloudflare build settings: root `/`, command `npm run build`, output `dist`.
- The public-site-port branch is **not deployed** by those settings. Do not report a page as live based on a GitHub commit.

## Build and test gate (Node 22, no GitHub Actions required)
Run in an environment with network access to npm:
```sh
cd apps/web
npm install --package-lock-only --ignore-scripts
npm ci
npm test
npm run build
```
Commit the generated `apps/web/package-lock.json` after verifying it. Run browser smoke tests for each implemented route on a non-production preview URL, including refresh/deep-link behavior, responsive navigation, auth redirects, and no Base44 network calls.

## Preview deployment (do not change production yet)
Use a separate Cloudflare Pages preview branch/build configuration or a separate free preview project with root `apps/web`, build command `npm ci && npm test && npm run build`, and output `dist`. Confirm `VITE_SUPABASE_URL=https://ssibsfmtodgximseeqsv.supabase.co` and a **publishable** browser key. Never expose secret/service-role keys. Check Supabase Auth redirect allowlist for preview and production origins.

## Cutover gate
Do not point `interplanetaryfund.com` at the new bundle until:
1. Browser/build tests pass; navigation and authentication are verified.
2. Original feature parity and remaining placeholders are resolved or explicitly accepted by owner.
3. Canonical Supabase campaigns, users and donations are reconciled; the current destination has no migrated public campaigns.
4. PayPal checkout/payouts, ledgers and withdrawal protections are independently verified, with no fake success paths.
5. No Base44 proxy routes remain for required production workflows; no DNS/email regression.
6. A rollback target is documented and production deploy smoke tests pass.

The new profile, connections, social and campaign draft pages are partial implementations, **not original-feature parity**.
