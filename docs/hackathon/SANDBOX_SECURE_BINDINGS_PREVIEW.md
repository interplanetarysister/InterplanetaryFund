# iFund PayPal sandbox secured credential runtime — 2026-11-10

This preview branch is created solely to validate the isolated PayPal sandbox gateway. No live funds or payouts are enabled.

- Pages Functions route: `/api/paypal/sandbox/{status,orders,capture,webhook}`
- Cloudflare Pages preview service binding `IFUND_SANDBOX_BROKER` → `ifund-sandbox-broker`.
- Dedicated Worker Secrets Store bindings: sandbox client ID, sandbox client secret, and signing private JWK. Never exposed to Pages/browser.
- Dedicated signed Supabase Edge Function `ifund-sandbox-receipts` for isolated `ifund_paypal_sandbox_orders` and `ifund_paypal_sandbox_events`.
- Sandbox webhook registration supplied: `51B35522F66392518`, originally registered to the deployment-specific URL `f69605aa.interplanetaryfund-migration.pages.dev`. This must be re-registered or updated to the actual stable preview URL before provider-backed readiness can pass.
- Production `ifund-payments` remains gated with `IFUND_PAYMENTS_ENABLED=false`.
- The gateway reports `enabled=false` unless PayPal OAuth and registration agree with its origin; do not mark a capture as successful without provider order and isolated DB evidence.

Testing and result tracking: `public.ifund_payment_path_test_evidence`. Test-only records are not donations or ledger balances.
