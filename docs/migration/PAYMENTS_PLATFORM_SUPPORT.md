# Payments PR 1: IFund platform-support donations

Authority: [issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137). Payments are done in their own PRs, and this one is the first. It covers only donations made **to Interplanetary Fund itself**. Campaign donations, subscriptions, the 3% fee, the optional 10% hosting gift, and campaign-owner withdrawals come in later payment PRs.

## Source behavior (interplanetary-fund2, read-only)
- `src/components/payments/PayPalDonateButton.jsx` and `src/lib/paypalLink.js` open the hosted PayPal payment link `https://www.paypal.com/ncp/payment/VMW5XU3Y46K5J`, which pays the IFund business PayPal account. These two files make no Base44 calls.
- Base44 never stored these payments as records. They were found afterwards by an admin receipt scan (`listUntrackedPayPalReceipts`).

## Ported, mapped to the new stack
| Source | New location | Change |
|---|---|---|
| `src/lib/paypalLink.js` | `src/lib/paypalLink.js` | Base44 removed. Campaign links use the new `/campaign/:id` route on interplanetaryfund.com. |
| `src/components/payments/PayPalDonateButton.jsx` | same path | No Base44 imports. Uses inline styles, so it doesn't depend on the old Tailwind/shadcn theme. |
| (none) | `src/pages/Support.jsx`, `/support` route, nav and footer link | New page for platform support. |
| `listUntrackedPayPalReceipts` receipt scan | `worker/paypalWebhook.js`, `POST /api/paypal/webhook` | Replaced by a PayPal webhook in the Cloudflare Worker. Each event is checked with PayPal's `verify-webhook-signature` API, and the payment is recorded through a service-role RPC. |
| (none) | `supabase/migrations/pending/payments_platform_support_001.sql` | `ifund_finance.platform_support_payment` and `ifund_finance.platform_support_webhook_event`. Both follow the Phase 2 mapping: RLS is on, clients are denied, and only `service_role` can write. The SQL is **not applied**. |

### How the webhook decides what to record
- Only captures explicitly tagged `ifund:platform-support:v1` may enter the platform-support ledger. **Untagged PayPal captures must never be treated as IFund support payments.**
- It handles `PAYMENT.CAPTURE.{COMPLETED, PENDING, DENIED, REVERSED, REFUNDED}` after signature verification and attribution checks.
- It ignores captures whose `custom_id` contains `|`. Those are legacy campaign checkout orders.
- It ignores `PAYMENT.SALE.*`, which is subscription billing.
- The same PayPal event ID is never recorded twice. Refunds only update already-attributed support captures; unmatched refunds are audited but do not create payments. A late COMPLETED event cannot overwrite a refund or reversal.

## Owner steps (not done by this PR)
1. Review the pending SQL, then apply it to staging.
2. In PayPal (sandbox first), create a REST app and a webhook pointing to `https://<worker-host>/api/paypal/webhook`, subscribed to the capture events listed above.
3. On the **separate, reviewed target Worker** (not the current Base44 proxy), stage `PAYPAL_MODE` (`sandbox` first), `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `SUPABASE_URL`, and preferably `SUPABASE_SECRET_KEY` (`sb_secret_...`). The handler also supports legacy `SUPABASE_SERVICE_ROLE_KEY` JWTs. Use `wrangler versions secret put` for a non-deployed version; `wrangler secret put` **deploys immediately**. Never commit the values or place them in `VITE_*`.
4. Make a sandbox payment and check that one row appears in `ifund_finance.platform_support_payment`.
5. Go live only after the DNS cutover. The Base44 path stays untouched until then (see BLOCKERS B11).

## Open questions
- Is the live REST app registered to the same business account that receives the hosted link (`cuddlemeplatonically@gmail.com`)? This is UNKNOWN. Webhooks only fire for the app's own account.
- Does PayPal send `PAYMENT.CAPTURE.*` for hosted payment-link (`ncp`) checkouts? Expected yes, but UNVERIFIED until the sandbox test in step 4. If it doesn't, port `listUntrackedPayPalReceipts` as a scheduled Worker that uses the Transaction Search API.

## Credential inventory check — 2026-10-25
- The authenticated Base44 CLI name listing contains the three PayPal names (`PAYPAL_MODE`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`), but **not** `PAYPAL_WEBHOOK_ID`; the latter needs its own verified registration. No secret values were obtained or copied.
- Read-only Cloudflare checks showed no secret bindings on current `interplanetary-fund2` and `ifund-oauth` Workers. That says nothing about future target Worker credentials or other environments.
- The owner-designated new Supabase project is `ssibsfmtodgximseeqsv` (PR #148), but the published Pages deployment has not been verified to use it; keep production untouched until data and auth parity.
- The Worker has been updated in this PR to use `apikey` only for modern `sb_secret_...` keys, while preserving legacy JWT support. Unit tests check both header paths. This is a **source-code change only**, not evidence of configured secrets or a working payment.
- Verify the PayPal REST-app merchant account matches the account receiving the hosted link. Capture notifications for hosted payment links are **unverified** and must be tested in sandbox before enabling live payments.

## Attribution safety correction — 2026-10-26
The existing hosted PayPal NCP link is **not a verified source of `custom_id` attribution**. Keep the link as an external payment link, but do not claim that NCP payments will automatically appear in the support ledger. A future first-party PayPal Orders flow must explicitly set `ifund:platform-support:v1` as its `custom_id`, or a reviewed provider-receipt reconciliation path must establish that a specific NCP capture belongs to the IFund support button. Webhook signature verification alone proves delivery by PayPal, **not** which purpose the payment served.
