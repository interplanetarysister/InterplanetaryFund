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
- It records `PAYMENT.CAPTURE.{COMPLETED, PENDING, DENIED, REVERSED, REFUNDED}`.
- It ignores captures whose `custom_id` contains `|`. Those are legacy campaign checkout orders.
- It ignores `PAYMENT.SALE.*`, which is subscription billing.
- The same PayPal event ID is never recorded twice. Refunds add up, and a late COMPLETED event never overwrites a refund or reversal.

## Owner steps (not done by this PR)
1. Review the pending SQL, then apply it to staging.
2. In PayPal (sandbox first), create a REST app and a webhook pointing to `https://<worker-host>/api/paypal/webhook`, subscribed to the capture events listed above.
3. Set the Worker secrets with `wrangler secret put`: `PAYPAL_MODE` (`sandbox` or `live`), `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Never commit them.
4. Make a sandbox payment and check that one row appears in `ifund_finance.platform_support_payment`.
5. Go live only after the DNS cutover. The Base44 path stays untouched until then (see BLOCKERS B11).

## Open questions
- Is the live REST app registered to the same business account that receives the hosted link (`cuddlemeplatonically@gmail.com`)? This is UNKNOWN. Webhooks only fire for the app's own account.
- Does PayPal send `PAYMENT.CAPTURE.*` for hosted payment-link (`ncp`) checkouts? Expected yes, but UNVERIFIED until the sandbox test in step 4. If it doesn't, port `listUntrackedPayPalReceipts` as a scheduled Worker that uses the Transaction Search API.
