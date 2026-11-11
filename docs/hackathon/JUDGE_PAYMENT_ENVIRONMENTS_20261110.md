# IFund judge payment environments — verified access instructions

**Scope:** Public judge UI in the existing `InterplanetaryFund` app. Neither path bypasses a payment provider's authentication or simulates a capture. Keep the Base44 reference out of payment runtime.

## Judge entrypoints

- Production landing page: https://interplanetaryfund.com/hackathon
- PayPal **sandbox** demo on the stable, segregated preview origin: https://feature-paypal-sandbox-secur.interplanetaryfund-migration.pages.dev/hackathon
- Real campaign checkout entry: https://interplanetaryfund.com/discover (real charges **only if** the production `/api/payments/health` returns `enabled=true` and `mode=live`; otherwise the public UI remains paused).
- Optional provider-hosted **live platform support** uses the existing `IFUND_PLATFORM_SUPPORT_PAYMENT_LINK` in `apps/web/src/lib/paypalLink.js`. It is **not** a campaign donation, does not supply a campaign receipt, and may charge real funds. The judge-facing page reuses this link; it does not add a payment processor.

## Observed verification on November 10, 2026 Pacific

- Direct HTTPS status at the stable sandbox alias returned HTTP 200 JSON `mode=sandbox`, `enabled=true`, `webhook_ready=true`, `database_ready=true`, `live_payments_enabled=false`.
- Direct HTTPS diagnostics returned `oauth_ready=true`, `webhook_registration_ready=true`, `webhook_origin_matches=true`, `capture_event_subscribed=true`. This proves configured readiness, **not** capture.
- Production `https://interplanetaryfund.com/api/payments/health` and the existing live `ifund-payments` Worker both returned `enabled=false` and `mode=live` — **live campaign charges are currently gated**.
- Database contained four `created` sandbox orders, zero captures, zero sandbox webhook events, and zero real donation rows. Do not call the sandbox fully payment-verified.
- Both public `/hackathon` URLs returned HTML over HTTPS. HTML success does not prove client-side rendering.
- Automatic production deployments remain gated in Cloudflare. Successful source commits and queued builds must not be described as hosted release completion.

## Judge test protocol

1. Choose the separate sandbox link; confirm the browser stays on the stable `pages.dev` preview and the eventual provider approval URL is at `sandbox.paypal.com`, **not** `paypal.com`.
2. Use a **Personal PayPal Sandbox buyer** supplied securely or owned by the judge; never use the merchant sandbox account. Do not publish buyer passwords, live payment card details, OAuth secrets, or access tokens.
3. Select an eligible, authentic active campaign, then create a $1–$10 test order. An order with status `CREATED` alone is **not** a payment.
4. Approve the order in PayPal Sandbox, return in the same browser session, and run server capture. Verify provider `COMPLETED`, matching capture ID and amount, exactly one isolated sandbox receipt and authenticated webhook event. Repeated captures/events must not duplicate records.
5. Verify failures fail closed, unsigned/tampered webhooks are rejected, and `ifund_donations`/public fundraiser totals stay unchanged.
6. For **live campaign** tests, only proceed if the production health endpoint explicitly says enabled and the existing verified ledger route works. Real charges should occur only by informed judge choice; sandbox credentials must never be entered into live checkout.
7. The optional live platform-support checkout is not proof of campaign donation capture or ledger reconciliation. Mark it separately.

## Release controls

No auto-enabling `IFUND_PAYMENTS_ENABLED` solely for judge demonstrations while the live ledger has not been verified end-to-end. Do not permit payouts/withdrawals until separate owner-only and 7% fee verification. Preserve $0 budget, no TinyFish, and no fabricated donation evidence.

Evidence is tracked in https://github.com/interplanetarysister/InterplanetaryFund/issues/203 and `docs/hackathon/PAYPAL_2026_COMPLIANCE.md`. Keep both statuses truthful as verification proceeds.
