# Interplanetary Fund — Independent PayPal + AI Hackathon Demo

**Official rules:** https://paypalaihackathon.devpost.com/rules  
**Judging demo:** https://ifund-hackathon-demo.interplanetary-fund.workers.dev/  
**Google Pay sandbox checkout:** https://ifund-hackathon-demo.interplanetary-fund.workers.dev/api/google-pay  
**Wallet prerequisites:** sign in to the isolated demo, choose a published fictional campaign, and use a browser/test wallet eligible for PayPal's Google Pay sandbox. If the wallet is ineligible, use the existing PayPal sandbox buyer flow. The standalone wallet page is linked from the judge guide and never uses production payment credentials. An authorized wallet flow is counted only after the sandbox PayPal capture and database receipt are verified. An eligible payment button or a passing synthetic test is **not** proof of a completed provider capture.  

**Entry point:** https://ifund-demo-ai-check.interplanetary-fund.workers.dev/ (redirects to the canonical demo)

This is a separate **fictional, sandbox-only** demo for PayPal AI Hackathon 2026. It does not process real donations or issue actual withdrawal privileges. It is independent from the production platform and does not use the Base44 runtime.

## What the application does

- Organizers use a Cloudflare Workers AI model to generate five alternative titles, two descriptions, a story, and rewritten story sections, then edit and publish fictional campaigns.
- Visitors browse fictional campaigns. Demo accounts use separate, isolated credentials; no real user identities are imported.
- A signed-in sandbox buyer creates a PayPal Orders v2 order for a campaign or fictional platform support, approves it in a **PayPal sandbox buyer account**, and returns for capture and reconciliation.
- The Worker verifies completed provider captures, issues a sandbox receipt, records double-entry ledger lines and validates PayPal webhook signatures. Duplicate webhook IDs are deduplicated.
- Authenticated donor/organizer/admin views report only the isolated sandbox data.
- All financial claims are conditional on provider confirmation; unconfirmed or cancelled orders do not count as successful contributions.

## Reproducible Worker deployment

The demo now contains **six restored authored TypeScript modules recovered from the deployed Worker's own source map** (`worker/core.ts`, `worker/paypal.ts`, `worker/ai.ts`, `worker/campaigns.ts`, `worker/index.ts`, and `src/sandbox-liability.ts`). The missing `worker/types.ts` declarations and independent TypeScript/esbuild build configuration have been reconstructed; `worker/app.js` remains the deployed compiled JavaScript snapshot and `worker/assets.js` holds the compiled frontend assets. This exposes inspectable payment/AI/campaign source and a repeatable Worker build. The **original authored frontend component sources are not yet recovered**, and no successful clean-source rebuild has been confirmed until the CI job passes. Do not claim fully complete first-principles frontend reproducibility.

### Build and source validation

From a clean clone, using Node.js 22:

```sh
cd demo
npm install --no-audit --no-fund
npm run typecheck
npm run build:worker
node --check worker/app.js
node scripts/judge-acceptance.mjs
```

The first four commands type-check and rebuild the Worker from authored TypeScript; the final command checks the publicly deployed judge demo without making PayPal transactions. The published compiled frontend assets remain a snapshot. This process requires no PayPal or Supabase credentials until you explicitly deploy.

Prerequisites: Cloudflare account with Workers enabled, an R2 bucket for fictional media, Cloudflare Workers AI entitlement, PayPal sandbox REST app, and a separate Supabase demo schema plus signed Edge Function. Use the existing canonical project and avoid creating live payment connections.

1. From the repository root, use `npx wrangler deploy --config demo/wrangler.jsonc` after confirming the bindings for the intended demo Worker.
2. Bind encrypted `DB_SIGNER` (ECDSA private JWK accepted by the authorized Supabase Edge Function), `PAYPAL_CLIENT_ID`, and `PAYPAL_CLIENT_SECRET` to the Worker using Cloudflare's secret tooling or account Secrets Store. Never write credentials in this repository.
3. Set `PAYPAL_WEBHOOK_ID` to the **actual ID registered for the deployed HTTPS `DEMO_ORIGIN`**, and verify the webhook URL is `${DEMO_ORIGIN}/api/paypal/webhook`. It must have `PAYMENT.CAPTURE.COMPLETED` subscribed.
4. Confirm the `SUPABASE_URL` points to the separately isolated demo tables (`ifund_demo_*`) and that the `ifund-demo-data` Edge Function only accepts authenticated, signed requests.
5. Check `GET /api/status`, then sign in with a demo-only account and check `GET /api/paypal/status` before trying a sandbox purchase.
6. Approve only using a PayPal **sandbox personal buyer** that is different from the sandbox business merchant. Never use real funding instruments. Reconcile and verify the receipt and ledger before marking payment successful.

The source export includes no provider secret values, passwords, or signing keys. The actual deployed runtime uses Cloudflare bindings that must be configured separately; a copy of this repo alone is not a substitute for those credentials and database provisioning.

## Security checks and evidence

See [VERIFICATION.md](VERIFICATION.md) for dated, independently observed checks and honest remaining gaps. Do not treat an HTTP 200 response or a database capture record as proof of all payment scenarios.

The demo worker uses:

- `/api/status` — public configuration flags, **not** a payment success indicator
- `/api/campaigns` — fictional, published public campaigns
- `/api/ai/generate` — authenticated Workers AI generation
- `/api/paypal/orders` — authenticated sandbox order creation
- `/api/paypal/orders/:id/capture` — provider capture
- `/api/paypal/orders/:id/reconcile` — provider status reconciliation
- `/api/paypal/webhook` — signed provider notifications
- `/api/finance` — role-based donor/organizer/admin finance views
- `/api/admin/tracker` — administrator-only verification tracker

**License:** repository [AGPL-3.0](../LICENSE); third-party dependencies retain their respective licenses. Do not reuse trademarked assets or copyrighted materials without permission.

## One-command public judge smoke test

From a fresh clone with Node.js 20 or newer, execute:

```sh
node demo/scripts/judge-acceptance.mjs
```

This zero-dependency script requests the **real hosted** public demo over HTTPS, verifies the React shell and assets, published fictional campaign data with image paths, sandbox-only status with withdrawals disabled, anonymous session state, and fail-closed privacy on sandbox PayPal status, finance, admin tracker and owner-only campaigns. It exits nonzero on failure. Point it at a distinct sandbox URL with `IFUND_DEMO_BASE_URL`; never use a production URL that may accept real payments. The script intentionally does **not** create PayPal orders or spoof a sandbox buyer, capture, webhook or successful finance record. It is an acceptance test artifact and is not evidence of a completed user-approval flow until separately executed and observed. The repo's historical provider database verification is described in [VERIFICATION.md](VERIFICATION.md).
