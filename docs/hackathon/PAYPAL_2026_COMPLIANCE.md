# IFund PayPal AI Hackathon 2026 — verification ledger

**Official rules:** https://paypalaihackathon.devpost.com/rules
**Submission deadline:** November 12, 2026, 12:00 PM Pacific.
**Canonical frontend:** original `interplanetary-fund2` Base44 app. **Independent demo/runtime:** `InterplanetaryFund` Cloudflare Pages/Workers + Supabase. **No Base44 runtime fallback.**

## What actually exists

- An existing live *hosted PayPal platform-support button* is separate from campaign donations and **does not prove the PayPal sandbox REST integration**.
- The independent app has a real Supabase-backed Story writing assistant and a seven-agent identity selector; seven full independent conversational agents are not yet verified.
- `/hackathon` is the demo journey. `/api/paypal/sandbox/status`, `/orders`, `/capture`, and `/webhook` are additive Cloudflare Pages Functions.
- Orders use `api-m.sandbox.paypal.com/v2/checkout/orders`; capture receipts must be confirmed by PayPal and saved before success is shown. The webhook listener uses PayPal's `verify-webhook-signature` API. Repeated webhook IDs are idempotent.
- Demo receipts reside ONLY in `ifund_paypal_sandbox_orders` and `ifund_paypal_sandbox_events`, with RLS and service-role-only access. They are **never** real `ifund_donations`, financial ledgers, withdrawals, or public donation totals.
- Code has fail-closed tests; **no end-to-end sandbox capture or signed webhook has been verified yet**. The feature must stay off until setup and tests are complete.

## Deploy and verification (only in an authorized preview)

1. On the **existing** Cloudflare Pages project `interplanetaryfund-migration` preview environment, set `IFUND_PAYPAL_SANDBOX_ENABLED=enabled` (after other keys are ready) and configure `PAYPAL_CLIENT_ID` plus matching `PAYPAL_CLIENT_SECRET` from the **same sandbox REST app**. Use encrypted secret bindings. Do not create a second PayPal app merely because a client ID is missing from this Pages environment.
2. Keep the existing `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in secure server-only bindings. The browser only receives public configuration/status; never expose the secret in Vite variables or Git.
3. Apply the additive migration `supabase/migrations/20261109_ifund_paypal_hackathon_sandbox_isolation.sql` to the current Supabase project after review. Confirm the RLS policies deny anonymous and ordinary authenticated clients.
4. In the *sandbox* PayPal REST app, subscribe the actual HTTPS preview URL `https://<preview-host>/api/paypal/sandbox/webhook`, record its **assigned webhook ID** as encrypted `PAYPAL_WEBHOOK_ID` (not as a webhook secret), and subscribe the appropriate Orders/Capture/Refund/Dispute events. Live webhook subscriptions do not configure the sandbox application. Never invent webhook IDs.
5. Open `/hackathon` on that exact preview host. An active owned/public demo campaign must exist; do not invent real fundraiser facts. Select a sandbox amount, approve with a provider-controlled sandbox buyer, return, and click verify/capture. Confirm exactly one isolated captured receipt, a corresponding verified PayPal order, and no change to real campaign totals.
6. Verify duplicate capture requests do not create second captures; unsigned/tampered webhooks are rejected; verified duplicate events are deduplicated; provider errors display no false success; unauthenticated browsers cannot read sandbox order/event tables directly.
7. Keep all live campaign donations and owner withdrawals disabled until separately verified and approved. The 7% platform fee is due at **real withdrawal**, not per sandbox checkout.

## Submission must be verifiably complete

- [ ] Working PayPal sandbox checkout, authorization, capture and verified webhook with screenshots/log receipts
- [ ] Live working AI assisted campaign drafting demonstrated, distinct from placeholders
- [x] Public repository and AGPL-3.0 license recognized by GitHub REST repository metadata on 2026-11-10 (`private=false`, `visibility=public`, `license.spdx_id=AGPL-3.0`); repository root `LICENSE` previously documented. Evidence: https://api.github.com/repos/interplanetarysister/InterplanetaryFund
- [ ] Reproducible setup/build instructions and safe judge test login, with no secrets committed
- [ ] Hosted functional demo with working sandbox test account OR exact local build instructions
- [ ] Public YouTube demonstration <3 minutes showing the actual product (no static-only demo)
- [ ] English text description of functionality, PayPal and AI and significant post-Oct 1 updates
- [ ] Confirm actual Devpost registration/submission before Nov 12 noon Pacific
- [ ] If AWS is represented, show the actual integration; AWS is not required by the official rules

**Security:** A PayPal client ID is publicly identifiable; the matching client secret and webhook validation are essential. Never publish sandbox buyer passwords, PayPal secrets, credentials or service keys in README, public repository, screenshots, logs, or demo submissions. Give judge access via a test environment with controlled credentials transmitted securely.

**Architecture:** Existing Base44 app publishes at `interplanetaryfund.base44.app`; Cloudflare/Supabase owns `interplanetaryfund.com`. No Base44 dependency or domain reintroduction is permitted.

## Cloudflare authenticated deployment provenance — 2026-11-10 06:29 Pacific

Cloudflare Pages project `interplanetaryfund-migration` is connected to `interplanetarysister/InterplanetaryFund`, with configured `root_dir=apps/web`, `build_command=npm ci --no-audit --no-fund && npm test && npm run build`, and `destination_dir=dist`. `production_deployments_enabled=false` at inspection time. The most recent inspected **preview** deployment was `16cfa7ed-4151-4d22-9cc5-6f0a4ed76161` (`https://16cfa7ed.interplanetaryfund-migration.pages.dev`), commit `0a9b0e1fd5287616dcc6a1e308ed9a33efc8f585` on the sandbox-compliance branch, Cloudflare stage `deploy/success` ending 2026-11-10 14:02:40 UTC. This verifies deployment metadata **only**; it does not verify public DNS reachability, `/hackathon` rendering, Pages Functions, PayPal capture/webhooks, or live AI generation. Those gates remain unchecked until direct functional evidence exists.

## Supabase authenticated table inspection — 2026-11-10 09:33 Pacific

Connected Supabase project `ssibsfmtodgximseeqsv` reports `public.ifund_paypal_sandbox_orders` and `public.ifund_paypal_sandbox_events` **both present with RLS enabled and 0 rows each**. `public.ifund_donations` likewise has 0 rows. This verifies the isolated sandbox table structures exist in the target project; it does **not** verify the exact migration history, individual RLS policies, PayPal provider calls, webhook signature validation, or an end-to-end capture. No successful sandbox receipt is recorded in these tables at inspection time. Keep payment compliance unchecked pending genuine provider-backed evidence. The campaign table contains 4 rows, but no campaign was verified as an authorized, accurately labeled showcase campaign. No publication or payment action was taken during this inspection.
