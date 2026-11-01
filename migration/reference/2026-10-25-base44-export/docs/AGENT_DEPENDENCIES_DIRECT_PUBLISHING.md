# IFund agent skills, browsers, and independent publishing

Audit date: 2026-10-11. This document covers the existing Interplanetary Fund application on Base44 main. It does not authorize or perform a DNS or backend cutover.

## Verified source inventory

- 9 configured Base44 agents, 47 declared function/entity tool references; the audit found zero unresolved local code references.
- 48 skill references (named and workspace IDs) are present in agent JSONC files. Only a live workspace skills inventory or successful agent execution can verify these skills are installed, entitled and actually exposed. A reference to a skill is not proof the agent can call it.
- playwright 1.64.0 is already a dev dependency of the React/Vite project.
- Chromium and its Linux dependencies were successfully downloaded/installed in the Base44 development sandbox and local browser tests passed. These sandbox system packages do not deploy to Cloudflare and may not persist in another sandbox.
- base44/functions/runBrowserConnection/entry.ts intentionally returns 503 with browser_execution_deferred. There is no executing browser agent through this function today.
- The Cloudflare gateway has no Browser Run browser binding or @cloudflare/playwright Worker import. This gateway currently routes MCP and admin-agent calls to the Base44 backend. It cannot become a browser merely by deploying React assets.
- The existing agent gateway executeAdminAgentRequest starts Base44 conversations: it is not a universal shell or browser. All provider authorization, approved tools and account ownership still apply.
- The current social-publishing runtime in base44/shared/socialPublish.ts has narrower actually implemented routes than the list of providers shown in the UI. Never claim all providers can publish just because they have connection records.

## Dependencies by runtime

**Frontend website and installed web app:** React/Vite + IFund UI. Do not ship Playwright, Chrome, Browserbase tokens, provider credentials, or browser-session cookies to browsers or the mobile app.

**Local developer/CI test sandbox:** Node 20+, npm, playwright dev dependency, an installed Chromium executable and Linux browser libraries. On a newly provisioned Linux machine, use npx playwright install --with-deps chromium. This is for testing; the installation alone gives no skills to backend agents.

**Base44 agents and backend:** Function/entity definitions and configured skill references must be synchronized to the Base44 backend and available to each agent by role. Verify by a live, authorized, read-only tool test. Browser automation is currently not available from the deferred browser connection function. Never turn a reserved skill name into a reported working capability without runtime evidence.

**Optional remote browser agent:** For Cloudflare, use a separate Cloudflare Browser Run Worker with a browser binding and the worker-compatible @cloudflare/playwright package, not the normal Node-only playwright browser executable. For compatibility confirm the current Cloudflare Browser Run docs. Use a controlled backend command API, permission/entitlement checks, per-user scopes, domain/redirect restrictions, secrets isolation, rate and cost quotas, audit logs, and explicit handoffs for provider-required verification. Enable only after confirming a valid hosting plan and provider terms; avoid a public open-browser endpoint.

## Updating IFund without Base44's AI builder

**Option A — stop using the Base44 AI builder, retain its backend temporarily:**

1. Change the authoritative IFund React/Vite repository using a local editor or connected development agent.
2. Install Node 20+ and npm. Run npm ci, then the checks and production build.
3. For the still-live Base44 website, use the Base44 CLI's supported site deployment after confirming its cost and the backend app ID. This removes reliance on builder message credits but still uses Base44 hosting and data/auth/functions.
4. For a Cloudflare-hosted preview, set the public VITE_BASE44_APP_ID and VITE_BASE44_APP_BASE_URL frontend build values to the existing verified Base44 backend. Do not use private keys in VITE_ variables.
5. Run npm run publish:cloudflare:validate. It checks agent references, builds the website, and tests browser rendering without any deployment. The command requires the frontend environment values and a local browser test environment.
6. Install Wrangler in the publishing environment (npm install --save-dev wrangler), connect/authorize Cloudflare via supported Wrangler login or existing protected API token, and run IFUND_CONFIRM_PREVIEW_DEPLOY=yes bash scripts/publish-ifund-cloudflare.sh deploy-preview. This updates the Workers preview deployment in root wrangler.toml; it does NOT move the primary custom domain. Confirm /help, /dashboard, login and backend calls work there.
7. Only when verified, explicitly cut over the main domain to Cloudflare's correct custom-domain/zone routes, retaining the existing API gateway and rollback path. Current wrangler.toml only routes selected API paths on interplanetaryfund.com; the root domain does not automatically follow the Workers preview update.

**Option B — remove Base44 entirely:** Completing Option A does NOT replace the backend. Separately migrate and verify authentication and accounts, RLS authorization, persistent entities and uploaded assets, financial ledger/PayPal reconciliation/webhooks, external connectors/OAuth, secrets, agents, scheduled jobs, MCP, withdrawals, domain/DNS and recovery. No double-writes to two money ledgers. Test using the actual live providers before switching. Only then turn off Base44 backend services.

## Website versus downloadable app

- IFund currently includes a web-app manifest (public/manifest.json), display=standalone. It uses the same hosted routes as the website. Installing it as a web app does not bundle the Help Center knowledge base; article content remains fetched from the host.
- Web app updates are deployed to the host and appear on subsequent app loads, subject to browser caching. No Play Store release is needed for web-only updates.
- If IFund later ships a separate APK/AAB/native shell, publishing that binary requires the chosen Android distribution/signing workflow for code or native integration changes. Web article text still updates independently.

## Validation truth

Run npm run verify:agent-dependencies, npm run verify:help-center, and npm run verify:browser-render. Passing local code checks never proves a live skill grant, provider publishing permission or production DNS status. There are no Help Center articles published by this audit.
