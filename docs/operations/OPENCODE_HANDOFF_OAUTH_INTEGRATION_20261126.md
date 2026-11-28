# OpenCode handoff — resume iFund integration work (2026-11-26)

**To the receiving OpenCode agent:** read this entire file before touching the repo. Work source-only first. Do **not** deploy, do **not** change Cloudflare/Supabase/provider settings, and do **not** fabricate acceptance evidence. The immediate task is to identify and repair the OAuth runtime blocker, then reconcile the repo with the live platform.

---

## 1. Where the work stopped (one paragraph)

The live Interplanetary Fund platform is **not** blocked at provider client IDs/secrets. It is blocked one gate earlier: its own OAuth runtime readiness check is failing. Live `GET /api/oauth/google/start` and `/api/oauth/github/start` return `503 {"error":"Provider connections are not configured."}`, which is verbatim `worker/oauth.js:778` (`if (!oauthRuntimeReady(env)) ...`). No provider is ever reached. Separately, the repo has **diverged from live**: live serves a member-facing `GET /api/oauth/readiness` endpoint that does not exist anywhere in this repo or its branches, while the repo's member Connections page calls the **admin-only** `/api/oauth/status` endpoint. Deploying the current repo as-is would hide the “Connect securely” button from every non-admin member.

The Stitch changes are a separate, design-only track and are **not** the blocker. They are already on `main` and stop at “local reference kit ready; never uploaded to a Stitch project.”

---

## 2. Environment and repo state

- Repo: `C:\Users\TopTier\Projects\InterplanetaryFund`
- Current checkout: branch `feature/michelle-rogers-executive-intelligence`, HEAD `e5b0a775`
- `main` tip: `16df82b9` (2026-11-23 PT), tag `ILF-checkpoint-main-2026-11-23`
- Canonical GitHub: `interplanetarysister/InterplanetaryFund`
- Live site: `https://interplanetaryfund.com`
- Cloudflare Pages project: `interplanetaryfund-migration`
- Canonical Supabase project: `ssibsfmtodgximseeqsv`
- Live bundle observed 2026-11-26: `assets/index-C935xdGa.js`, `assets/index-uYcZ6bxy.css`
- Live Connections chunk: `assets/ManagePermissions-EdPF4T6J.js` (calls `/api/oauth/readiness`)

**Dirty working tree warning:** the checkout already contains unrelated, uncommitted Michelle Rogers executive-intelligence work:

```
 M worker/index.js
 M workers/ifund-payments/payout-subscription-sale-guards.test.mjs
 M workers/ifund-payments/subscription-refund-boundary.test.mjs
 M workers/ifund-payments/worker.js
?? src/pages/ExecutiveCommandCenter.jsx
?? src/pages/InvestorMeetingRoom.jsx
?? supabase/migrations/20261124000000_ifund_michelle_rogers_executive_intelligence.sql
?? tests/michelle-rogers-executive-intelligence.test.js
?? worker/agents/michelle.js
?? worker/agents/michelle.test.mjs
?? worker/services/executiveIntelligence.js
```

Do **not** commit, revert, delete, or bundle these files. Create a fresh branch off `main` for the OAuth reconciliation, and leave the Michelle work untouched in the existing checkout.

> Note: this handoff document is itself a new untracked file. Commit it only if the owner asks.

---

## 3. Evidence gathered (2026-11-26)

### 3.1 Live endpoint probes

| Live endpoint | Response |
|---|---|
| `GET /api/oauth/readiness` | `401 {"error":"Sign in before checking provider readiness."}` |
| `GET /api/oauth/status` | `403 {"error":"Verified administrator access required."}` |
| `GET /api/oauth/google/start` | `503 {"error":"Provider connections are not configured."}` |
| `GET /api/oauth/github/start` | `503 {"error":"Provider connections are not configured."}` |
| `GET /api/oauth/nope/start` | `404 {"error":"Provider not supported."}` |
| `GET /api/oauth/google/disconnect` | `405 {"error":"Method not allowed."}` |

Interpretation:

- The `503` string is exactly `worker/oauth.js:778`.
- `oauthRuntimeReady(env)` is the AND of six checks (`worker/oauth.js:258-278`):
  1. `OAUTH_API_ENABLED === 'true'`
  2. `OAUTH_FRONTEND_ORIGINS` is valid
  3. `SUPABASE_URL` exactly equals `https://ssibsfmtodgximseeqsv.supabase.co`
  4. `SUPABASE_PUBLISHABLE_KEY` is non-empty
  5. `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`) is > 20 chars
  6. `OAUTH_ENCRYPTION_KEY` decodes to exactly 32 bytes
- Because `/api/oauth/nope/start` returns `404` before the runtime gate, and valid providers return `503`, the gate ordering in the repo matches live.
- The 2026-11-18 audit (`docs/integrations/PROVIDER_OAUTH_FOUNDATION.md`) verified binding **names**, but explicitly could not validate values. Most likely failing check: `OAUTH_API_ENABLED` is false, `OAUTH_ENCRYPTION_KEY` is missing/invalid base64, `SUPABASE_URL` no longer matches canonical, or `SUPABASE_SECRET_KEY` is empty.

### 3.2 Repo vs live divergence

- Live frontend (`ManagePermissions-EdPF4T6J.js`) calls `/api/oauth/readiness`.
- Repo `apps/web/src/pages/Connections.jsx:103` calls `/api/oauth/status`.
- Repo `worker/oauth.js:737` returns `403` to anyone who is not a verified admin.
- Repo test `tests/oauth-runtime-readiness.test.js:81` explicitly asserts “OAuth status denies active non-admin members.”
- Grep for `oauth/readiness` and `Sign in before checking provider readiness` across the repo and all local branches: **zero hits**. The live worker contains code that is not in this repo’s history.
- Consequence of deploying the repo as-is: member gets `403` → `providerReady = {}` (`Connections.jsx:105`) → `canStart = false` (`Connections.jsx:135`) → “Connect securely” never renders (`Connections.jsx:330`), even after provider credentials are configured.

### 3.3 Stitch state (do not redo this work)

Commits already on `main`: `90da0524`, `5e8355a3`, `b1c54b16`, `0c12b0bf`, `ea18a7f4`, `1b12ef79` (2026-11-20/21). They are additive to `.stitch/` only. `.stitch/README.md` line 16 records that the third step — import into a real Stitch project — was never performed. The kit covers `/`, `/dashboard`, `/login`, `/what-if`, `/create`, `/agents`, agent chat; it does **not** cover `/connections`, `/oauth/callback/:provider`, payments, or other integrations.

### 3.4 Other integration surfaces (context)

- `integrations/paypal-orders-client.mjs` is a read-only `GET /v2/checkout/orders/{id}` adapter, imported only by its own test — not wired to any worker or route.
- `integrations/alexa/interaction-model.json` is explicitly “not an active Alexa skill”: not submitted, not hosted, no endpoint, no account linking.
- Six `IFUND_*_AGENT` hosted bindings are not declared in repo Wrangler configs; `IFUND_TEAM_CONTEXT_ENABLED` remains disabled.
- Payment worker reportedly has `IFUND_PAYMENTS_ENABLED=true`, `IFUND_PAYPAL_MODE=live`, and a webhook ID, but source remains fail-closed and live capture/refund acceptance is unverified.

---

## 4. Hard constraints

1. **No deployment:** no Cloudflare Pages publish, no Worker deploy, no Supabase migration application, no R2 change, no provider dashboard change.
2. **No secret mutation:** do not create, read, rotate, or paste secrets. Binding names only.
3. **No fabricated evidence:** do not mark live acceptance, provider consent, or a deployment as verified without a real receipt.
4. **Preserve unrelated work:** do not touch the Michelle Rogers files listed in §2.
5. **Preserve financial policy:** the 7% withdrawal fee is unchanged; no payment activation.
6. **Fail closed:** if a credential or approval is absent, return/record `BLOCKED / UNVERIFIED`.
7. **Work source-first:** repair and test locally before any preview request. Separate “local test passed” from “live accepted.”

---

## 5. Task list for the receiving agent

### Task 0 — Establish a clean work branch

```powershell
cd C:\Users\TopTier\Projects\InterplanetaryFund
git status --short
git switch -c fix/oauth-runtime-reconcile-20261126 main
```

Confirm the Michelle files are not carried over. If Git blocks because of local changes, use a worktree instead of stashing/deleting:

```powershell
git worktree add C:\Users\TopTier\AppData\Local\Temp\opencode\ifund-oauth-work -b fix/oauth-runtime-reconcile-20261126 main
```

### Task 1 — Identify which runtime check fails on live

Preferred, read-only:

```powershell
# Requires a verified admin Supabase session token in $env:IFUND_ADMIN_JWT
curl.exe -s -H "Origin: https://interplanetaryfund.com" `
  -H "Authorization: Bearer $env:IFUND_ADMIN_JWT" `
  https://interplanetaryfund.com/api/oauth/status
```

The response contains `runtime: [{ name, configured }, ...]` and `providers`. Record which of the six `configured` values is false. Do **not** print or store the token.

If no admin token is available, report the blocker; do not guess. The owner may need to inspect the Pages project environment for `OAUTH_API_ENABLED`, `OAUTH_FRONTEND_ORIGINS`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `OAUTH_ENCRYPTION_KEY`.

### Task 2 — Reconcile the member readiness contract (source repair)

Choose one of these, based on owner direction:

- **Option A (match live):** add a member-authenticated `GET /api/oauth/readiness` route to `worker/oauth.js` that:
  - requires a signed-in active member (not admin);
  - returns `{ enabled, providers: { <name>: boolean } }` with no secret values;
  - keeps `/api/oauth/status` as the admin-only diagnostic.
- **Option B (match repo):** change `Connections.jsx` to a member-safe endpoint and keep `/api/oauth/status` admin-only.

Do not let a member page depend on the admin-only endpoint. Add regression coverage in:

- `tests/provider-oauth.test.js`
- `tests/oauth-runtime-readiness.test.js`
- `apps/web/tests/oauth-pages-gateway.test.js`
- `apps/web/tests/connection-alias-status.test.js` (if aliases change)

Also verify `apps/web/src/lib/connectionCatalog.mjs` alias mapping (`facebook → facebook_pages`, etc.) still matches the worker provider names.

### Task 3 — Fix the live runtime gate (owner-authorized only)

Once Task 1 identifies the failing check:

- If `OAUTH_API_ENABLED` is false, ask the owner before setting it to `true`; confirm all other gates first.
- If `OAUTH_ENCRYPTION_KEY` is invalid, the owner must supply a fresh base64-encoded 32-byte key; never commit it.
- If `SUPABASE_URL` is non-canonical, do not silently repoint; confirm the active project first.
- If `SUPABASE_SECRET_KEY` is empty, the owner must bind the server-only key.

After any authorized change, re-probe:

```powershell
curl.exe -s -H "Origin: https://interplanetaryfund.com" https://interplanetaryfund.com/api/oauth/google/start
```

Expected transition: `503 not configured` → `401 sign in` (unauthenticated) or `200 { authorization_url }` (authenticated member). Do not treat a `401` as success for the browser flow.

### Task 4 — Provider credentials and real consent (after runtime passes)

For one low-friction provider (GitHub or Discord), confirm:

1. provider app registration exists;
2. approval flag is `true`;
3. `*_CLIENT_ID` and `*_CLIENT_SECRET` are bound;
4. a real member completes `start → consent → callback → refresh → disconnect`;
5. tokens are stored only in the encrypted vault tables;
6. no token appears in a URL, log, or client bundle.

Then repeat per provider. Until then, keep every unverified provider unavailable.

### Task 5 — Reconcile live bundle to a known commit

The live bundle (`index-C935xdGa.js`, `ManagePermissions-EdPF4T6J.js`) does not correspond to this repo or any local `dist` (`index-CCaeGeC_.js` / `ManagePermissions-BQrliewf.js`). Determine which source tree produced the live build before promoting anything. Do not overwrite live with the repo until Task 2 is fixed.

### Task 6 — Re-run focused verification

```powershell
cd C:\Users\TopTier\Projects\InterplanetaryFund
node --test tests/provider-oauth.test.js tests/oauth-runtime-readiness.test.js
cd apps/web
node --test tests/oauth-pages-gateway.test.js tests/connection-alias-status.test.js
```

Optional, only if the change touches Stitch references:

```powershell
cd C:\Users\TopTier\Projects\InterplanetaryFund
node --test tests/stitch-design-reference-contract.test.mjs
```

Report exact counts and exit codes. Do not claim the full suite passed unless it was run.

---

## 6. Known blockers / missing credentials

These were absent in the prior session; confirm before relying on them:

- `CLOUDFLARE_API_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PROJECT_REF`
- `IFUND_QA_PROVISION_APPROVED`
- Wrangler authentication (`wrangler` reported “You are not authenticated.”)
- A verified admin JWT for `/api/oauth/status`
- Playwright/browser runtime for authenticated role acceptance

If absent, stop at the corresponding boundary and report `BLOCKED / UNVERIFIED`. Do not simulate a credential or infer live state.

---

## 7. Required deliverable format

When reporting back, use this structure:

1. **What changed** — files + commits, source-only.
2. **What was verified** — command, exit code, pass/fail counts, timestamp.
3. **What was not verified** — explicit `BLOCKED / UNVERIFIED` list and the missing credential.
4. **Live probe receipts** — exact endpoint, status, and body (redact tokens).
5. **Next blocking decision** — the one thing the owner must authorize or supply.

Do not use phrases like “integration complete,” “production ready,” or “live verified” unless a real signed-in provider round trip and deployment receipt exist.

---

## 8. Key file index

| Purpose | Path |
|---|---|
| OAuth handler | `worker/oauth.js` |
| Runtime gate | `worker/oauth.js:258-278`, `:778` |
| Admin status route | `worker/oauth.js:708-746` |
| Start/callback/refresh | `worker/oauth.js:747-...` |
| Member Connections UI | `apps/web/src/pages/Connections.jsx` |
| Admin diagnostics UI | `apps/web/src/pages/AdminConnections.jsx` |
| Provider catalog / aliases | `apps/web/src/lib/connectionCatalog.mjs` |
| Pages Function entry | `apps/web/functions/api/oauth/[[path]].js` |
| Provider OAuth audit | `docs/integrations/PROVIDER_OAUTH_FOUNDATION.md` |
| Route acceptance audit | `docs/operations/ROUTE_BACKLOG_EVIDENCE_AUDIT_20261121.md` |
| Sync/verification evidence | `docs/operations/IFUND_SYNC_AND_VERIFICATION_EVIDENCE_20261122.md` |
| Stitch kit | `.stitch/README.md`, `.stitch/DESIGN.md` |
| PayPal adapter | `integrations/paypal-orders-client.mjs` |
| Alexa prep | `integrations/alexa/README.md` |

---

## 9. One-line resume instruction

> Fix the live OAuth runtime gate first (identify which of the six `oauthRuntimeReady` checks is false), then reconcile the repo’s member readiness endpoint with live (`/api/oauth/readiness` vs admin-only `/api/oauth/status`). Do not deploy or change secrets without owner authorization.
