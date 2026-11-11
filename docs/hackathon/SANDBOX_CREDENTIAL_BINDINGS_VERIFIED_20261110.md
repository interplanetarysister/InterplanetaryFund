# IFund PayPal sandbox — verified credential bindings and callback (2026-11-10 Pacific)

**Status: sandbox runtime configured and provider-verified. This is not a completed checkout/capture acceptance test.**

## Permanent endpoints

- Demo: https://feature-paypal-sandbox-secur.interplanetaryfund-migration.pages.dev/hackathon
- Readiness: https://feature-paypal-sandbox-secur.interplanetaryfund-migration.pages.dev/api/paypal/sandbox/status
- Redacted diagnostics: https://feature-paypal-sandbox-secur.interplanetaryfund-migration.pages.dev/api/paypal/sandbox/diagnostics
- Create sandbox order: `POST /api/paypal/sandbox/orders`
- Capture approved sandbox order: `POST /api/paypal/sandbox/capture`
- Signed provider webhook: `POST /api/paypal/sandbox/webhook`
- Registered PayPal sandbox webhook ID: `51B35522F66392518`.
- **Callback URL now registered and provider-verified:** https://feature-paypal-sandbox-secur.interplanetaryfund-migration.pages.dev/api/paypal/sandbox/webhook

## Credential and storage bindings (identifiers only; NO secret values)

1. Cloudflare Pages `interplanetaryfund-migration` **preview**: `IFUND_PAYPAL_SANDBOX_ENABLED=enabled`, `PAYPAL_WEBHOOK_ID=51B35522F66392518`, `SUPABASE_URL=https://ssibsfmtodgximseeqsv.supabase.co`, service binding `IFUND_SANDBOX_BROKER` → Worker `ifund-sandbox-broker`.
2. Worker **Secrets Store** bindings (account-level store `default_secrets_store`):
   - `PAYPAL_CLIENT_ID` → `Paypal_sandbox_app_id`
   - `PAYPAL_CLIENT_SECRET` → `paypal_sandbox_app_secret`
   - `IFUND_PAYMENTS_EDGE_SIGNING_PRIVATE_JWK` → same-named stored secret
   The alternative stored pair `paypal_sandbox_client_id` / `paypal_sandbox_client_secret` also authenticated but did **not** belong to the app that owns webhook `51B35522F66392518`. Do not accidentally swap the live or alternative sandbox pair in.
3. Pages Function calls this dedicated Worker through a private Cloudflare service binding. The Worker obtains short-lived sandbox OAuth tokens; no PayPal client secrets are delivered to Pages or browsers.
4. For receipts, the Worker cryptographically signs requests to the deployed `ifund-sandbox-receipts` Supabase Edge Function. This function holds database server access internally and accepts only whitelisted `ifund_campaigns` reads and isolated `ifund_paypal_sandbox_orders` / `ifund_paypal_sandbox_events` operations. Sandbox receipts cannot enter the real `ifund_donations` or live ledger through this interface.
5. The production `ifund-payments` Worker remains `IFUND_PAYMENTS_ENABLED=false`, with live credentials still bound but checkout gated. Withdrawals remain disabled.

## Evidence from real HTTPS requests, no buyer charges

- Redacted preview `diagnostics` returned HTTP 200: `configured=true`, `oauth_ready=true`, `webhook_registration_ready=true`, `webhook_origin_matches=true` (via subsequent `status`), `database_ready=true`, `live_payments_enabled=false`.
- After updating the **existing** sandbox webhook registration from immutable `f69605aa` to the stable branch alias, PayPal REST API confirmed the webhook ID and destination. No new PayPal app or duplicate webhook was created.
- `GET /api/paypal/sandbox/status` returned HTTP 200 with `mode=sandbox`, `enabled=true`, `webhook_ready=true`, `database_ready=true`, `live_payments_enabled=false`.
- Real unsigned webhook `POST /api/paypal/sandbox/webhook` returned HTTP 400 `Missing webhook signature headers`, with no financial writes.
- Temporary callback migration endpoint was removed from both public Pages source and the deployed internal credential broker. Do not restore it.
- Supabase `public.ifund_payment_path_test_evidence` holds `test_only=true` evidence rows; successful config probes are recorded as configuration checks and **never** represented as PayPal captures.
- Supabase receipt and real donation tables were zero rows during the preceding audit. Real provider sandbox checkout, approval, capture, signed delivery, and idempotent receipt reconciliation remain required.

## Release discipline

Keep the **stable branch alias** for judge access. Deployment-hash `pages.dev` URLs are immutable and should not become webhook destinations. Do not put client secrets, signed tokens, buyer passwords or database service keys in GitHub. Do not enable live checkout automatically; restore only under the user's previously established approval gate after sandbox tests. Do not assign campaign receipts to platform-support payments.

Trace each acceptance case in `ifund_payment_path_test_evidence` and GitHub issue #203. Sandbox receipt records must remain marked as test and excluded from real finance.
