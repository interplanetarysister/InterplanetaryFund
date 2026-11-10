# iFund PayPal AI Hackathon — judge testing guide (verification pending)

This guide is intentionally **not** a certification of a functioning payment demo. See [PAYPAL_2026_COMPLIANCE.md](PAYPAL_2026_COMPLIANCE.md) for the current evidence ledger and release gates.

## Architecture and source
- Deployable source: https://github.com/interplanetarysister/InterplanetaryFund (AGPL-3.0).
- Original Base44 application is a **visual/functional reference only**; it is not a backend fallback.
- Runtime: Cloudflare Pages/Workers + Supabase. The PayPal sandbox must use its own sandbox REST app credentials, webhook ID, and isolated database tables.
- Never use live PayPal credentials or a live buyer for this demonstration.

## Reproducible setup (maintainer)
1. Clone the deployable repository at a recorded commit SHA, using Node.js 22 and npm. The repository has **two distinct Vite frontends**. Reproduce both locally using the commands below, and record the commit SHA and results. These are repository-declared commands, **not a claim that a clean-room build has already passed**.

   ```bash
   git clone https://github.com/interplanetarysister/InterplanetaryFund.git
   cd InterplanetaryFund
   git checkout feature/paypal-hackathon-sandbox-compliance-20261109
   git rev-parse HEAD
   npm ci --no-audit --no-fund
   npm test
   npm run build
   cd apps/web
   npm ci --no-audit --no-fund
   npm test
   npm run build
   test -f dist/_redirects && test -f dist/_headers
   ```

   The root app and `apps/web` are not interchangeable: the manual Pages workflow builds `apps/web/dist`, while the hackathon Pages Functions and `/hackathon` route must be checked against the **actual Cloudflare Git deployment build root and artifact**. Do not assume a successful build of one frontend proves the other is deployed. Never publish a bundle missing its expected Functions/routes.
2. Provision an authorized Cloudflare **preview** deployment, not production. Configure server-only encrypted bindings for matching sandbox PayPal client ID/secret, sandbox webhook ID, Supabase URL and server secret. Do not place these in Vite public variables or source control.
3. Review and apply `supabase/migrations/20261109_ifund_paypal_hackathon_sandbox_isolation.sql` in the intended Supabase environment; verify anonymous/authenticated clients cannot read sandbox order/event tables.
4. Register the exact deployed preview webhook URL `https://<actual-preview-host>/api/paypal/sandbox/webhook` with the PayPal **sandbox** app. Save the provider-assigned webhook ID as a secret binding.
5. Only after the above, enable `IFUND_PAYPAL_SANDBOX_ENABLED=enabled` on preview. Check `/api/paypal/sandbox/status`; if unavailable, disabled, or unhealthy, stop and report the demo as blocked.


## Preview smoke checks (safe, read-only)
Run these against the **actual Cloudflare deployment URL** after checking its build SHA and Pages Functions routing. A DNS failure, HTML SPA fallback, or HTTP 200 alone does not prove the API is functioning. Never paste private keys or sandbox buyer credentials into these commands.

```bash
PREVIEW_ORIGIN='https://REPLACE-WITH-VERIFIED-PREVIEW-HOST'
curl --fail-with-body --show-error --location --max-time 20 "$PREVIEW_ORIGIN/hackathon"
curl --show-error --include --max-time 20 "$PREVIEW_ORIGIN/api/paypal/sandbox/status"
```

Inspect the second response's **HTTP status, Content-Type, and parsed JSON status**, and confirm it comes from the sandbox status Function rather than the SPA's index.html. A disabled status is a valid fail-closed outcome, **not** a passed checkout test. Do not issue `/orders`, `/capture`, or webhook POST requests until an authorized sandbox test operator has configured matching sandbox credentials and the isolated database migration. Preserve redacted request/response evidence and provider-side records; do not publicly log access tokens or payment identifiers tied to people.

## Judge walkthrough (only after hosted verification)
1. Open the **verified** preview `/hackathon` route; confirm the app loads on desktop and mobile.
2. Demonstrate a real AI campaign-drafting action. Record input, generated output, and an actual saved draft where permitted. Clearly distinguish implemented AI from static samples.
3. Choose a clearly labeled **DEMO / NO REAL FUNDRAISING** campaign. In the PayPal sandbox flow, approve using a controlled sandbox buyer, then capture/verify. Do not enter live financial details.
4. Show a PayPal-confirmed order/capture, exactly one corresponding isolated Supabase receipt, a verified webhook event, and a repeat capture that does **not** duplicate receipts.
5. Confirm real campaign totals and financial ledgers remain unchanged. Confirm invalid/unsigned webhooks and provider failures do not show success.
6. If any step fails, document the error and do **not** describe PayPal integration as complete.

## Access and evidence handling
- Supply judge test credentials **privately through the submission's permitted secure channel**, never in this repository, public video, issue comments, or screenshots. Prefer disposable least-privilege test users. Never share an owner/super-admin account.
- Capture timestamped evidence: deployed URL and commit, PayPal sandbox order/capture identifiers (redacted as appropriate), webhook verification result, isolated receipt count, RLS checks, and AI input/output.
- Publish a public YouTube video **under three minutes** showing real software, not a mockup; check public visibility and runtime before adding the verified link.
- Submit a truthful English description and verify a final Devpost submission receipt before November 12, 2026 at noon Pacific. Do not claim acceptance without evidence.
- No unsolicited external posts, paid AI credits, live charges, or unverified demo donations.

## Evidence register
| Gate | Evidence URL / identifier | Result |
| --- | --- | --- |
| Cloudflare preview deployment provenance | `16cfa7ed.interplanetaryfund-migration.pages.dev` · deployment `16cfa7ed-4151-4d22-9cc5-6f0a4ed76161` · source `0a9b0e1fd5287616dcc6a1e308ed9a33efc8f585` · deploy/success at 2026-11-10 14:02:40 UTC (see compliance ledger) | Deployment metadata verified; HTTP routes/functions unverified |
| Real sandbox order and capture | Pending | Unverified |
| Signed webhook and deduplication | Pending | Unverified |
| Isolated Supabase receipt / RLS | Supabase project `ssibsfmtodgximseeqsv`, catalog inspection 2026-11-10 12:19 Pacific: both sandbox tables exist, RLS enabled, zero policies, anon/authenticated SELECT and INSERT privileges denied; both tables contained 0 rows (see compliance ledger) | Catalog-level isolation verified; negative API tests and real provider-backed receipt still unverified |
| Hosted AI drafting | Pending | Unverified |
| Public YouTube video (<3 minutes) | Pending | Unverified |
| Devpost submission receipt | Pending | Unverified |

Update the compliance ledger and this register only with provider-backed or directly observed evidence.
