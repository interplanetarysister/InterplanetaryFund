# PayPal Business integration contract — 2026-10-26

Owner-approved target merchant **cuddlemeplatonically@gmail.com**. The value is a routing requirement, **not proof** that a matching PayPal REST app, merchant ID, live webhook, Payouts, or Billing products are authorized. Retire Base44 dependencies; work only in independent \`interplanetarysister/InterplanetaryFund\`. Supabase production target \`ssibsfmtodgximseeqsv\`. **No real charges, paid subscriptions, or funds disbursed during this change.**

## Concrete coverage

| Flow | Location | Required behavior | Activation status |
|---|---|---|---|
| IFund donations to platform | \`worker/paypalWebhook.js\`, \`paypalRouting.js\` and existing hosted link | PayPal verified capture; exact platform-only attribution; refunds/reversals; prevent mixing with campaign funds | **OFF** — hosted NCP link does not prove custom_id tagging |
| One-time campaign gifts | \`worker/paypalBusiness.js\` donationOrder/giftQuote/verifyCampaignCapture | Server-generated orders; full gift-first; optional +10% support; provider fees distinct; actual receipt verified via PayPal GET order and matching merchant ID; one immutable operation/holding ledger record per capture | **OFF** — campaign data/auth parity absent |
| Google Pay / Apple Pay | Same verified PayPal merchant ledger as campaign gifts when those PayPal features are officially enabled for this merchant | Do not assume capability just because source supported the channel | **OFF**, unapproved |
| Creator subscription plans | \`worker/paypalBusiness.js\` subscriptionQuote/verifySubscriptionPlan/subscriptionOrder; independent webhook event classifier | Basic $12 monthly candidate; matching USD/year-month & status; preserve catalog prices; user consent and persistent intent; only verified billing data grants subscription benefits | **OFF** — plans not provider-verified |
| Recurring subscription invoices and refunds | \`worker/paypalRouting.js\` | \`PAYMENT.SALE.*\` mapped to verified billing agreement, not sale ID; subscriptions must match stored user and plan before entitlement | **OFF** — no subscription ledger RPC |
| Creator withdrawals | \`worker/paypalBusiness.js\` withdrawalMath/reservedPayout | Beneficial owner, available balance, one daily withdrawal unless approved subscription exception, 3% IFund fee at withdrawal, unique ledger reservation and PayPal Payouts batch | **OFF** — Payouts entitlement and ledger approvals absent |
| Auctions / item hosting | `worker/paypalBusiness.js` `auctionPayoutMath` (staged) | Distinct 10% auction hosting/withdrawal fee, separate from ordinary campaign withdrawal 3%; never double-charge | **OFF** — fee helper implemented, auction ledger and checkout not connected |
| Two missing historic PayPal receipts | Future receipt recovery/reconciliation flow | Use read-only PayPal transaction search with source-account proof and one-time canonical booking. No silent creation of donation rows | **BLOCKED** by API access + source record matching |

## Key source business rules

- Intended receiving PayPal Business account: cuddlemeplatonically@gmail.com.
- IFund gives the campaign owner the donor's full **gift** amount before any withdrawal fee. Optional 10% supporter contribution is on top. Processor fees are separately quoted and verified against actual PayPal settlement.
- 3% ordinary campaign withdrawal fee, disclosed to the campaign owner when withdrawing. Creator balance shows gift first.
- Existing owner-supplied candidate basic monthly plan: \`P-6YD2273006199630KNLDXBLA\` at **$12.00** USD. Never assume candidate plans are active just from identifier.
- Historical source catalog: basic ($12/$115); outreach ($49/$470); professional ($99/$950); enterprise ($199/$1910); nonprofit ($29/$280), monthly/annual. Pricing is not proof that PayPal plans currently exist. Catalog migration does not automatically create or enable paid plans.

## Current verified infrastructure

Cloudflare Pages \`interplanetaryfund-migration\` is active with apex/www; production branch \`migration/phase7-offline-cutover-gate\`, production auto-deploy disabled. \`VITE_SUPABASE_URL\` points to \`https://ssibsfmtodgximseeqsv.supabase.co\`. Read-only Cloudflare inspection did **not** find PayPal secret bindings on \`interplanetary-fund2\`, \`ifund-oauth\`, or \`ifund-email-ingress\` Workers. The deployed \`interplanetary-fund2\` Worker still contains Base44 proxy paths and Base44 campaign-assistant dependency, so website host independence does not mean full Base44 migration. Independent Supabase production finance tables are RLS-enabled but had no confirmed live campaigns/ledger records. No PayPal access is available through the connected app tools.

## External provider configuration required before sandbox verification

1. Authenticate to the **correct PayPal Business account** via an owner-controlled session. Obtain matching sandbox and live REST apps, merchant IDs, and client secrets through the official PayPal Developer dashboard; do not collect credentials in chat.
2. Verify PayPal app owner/merchant identity. Confirm capability for Orders, Billing Subscriptions, and separately approved Payouts. Verify existing $12 monthly candidate plan with a read-only PayPal API request; verify/create other approved plans only if absent, and never overwrite plans with active subscribers.
3. Create an authorized sandbox webhook for the *new independent* Worker origin; subscribe to capture, subscription, sale, and payout-status events actually needed. Set \`PAYPAL_WEBHOOK_ID\` for that app/mode; preserve and verify original raw webhook JSON.
4. Bind names in \`worker/.dev.vars.example\` as **server-side secrets** (Cloudflare Worker Secret bindings or equivalent), not Pages' frontend \`VITE_*\` vars. Do not place keys in GitHub or source code. Do not use \`wrangler secret put\` against production casually because it can activate a deployment.
5. Independently review/apply suitable financial migrations and provider-authoritative RPC functions to the owner-designated Supabase project (staging first). Ensure fund-operation idempotency (unique capture/order/batch), immutable allocations, chargeback/reversal handling, correct RLS/roles and admin audit.
6. Verify a sandbox one-time payment, duplicate webhook, reversed delivery order, refund, subscription activation/failure/cancellation, and payout simulation with actual provider credentials and ledger rows. Reconcile PayPal receipts and Supabase balances; verify merchant matching on every capture.
7. **Only** enable real checkout and payouts after owner review of exact deployment and verified eligibility. Production funding and disbursement should be enabled independently. No public page may claim working payments until the end-to-end provider + ledger path actually succeeds.

## Code verification limitation

A focused no-network JavaScript check of the new PayPal Business helper passed 11 of 11. This is not a payment integration test. The GitHub PR is staged and not deployed. Node CI, sandbox provider verification, merchant ownership, SQL/RLS, subscribed-user authorization, and Payouts eligibility still require direct proofs.

## Independent webhook inbox (staged, not deployed)

The `/api/paypal/unified-webhook` handler accepts signed PayPal REST events only after `IFUND_PAYPAL_INBOX_ENABLED=enabled`, independently verified merchant ID, matching registered PayPal webhook ID and a private Supabase service key. It stores all relevant verified capture, refund, subscription and payout events in the private `ifund_finance.paypal_webhook_inbox` table. Unknown or wrong-merchant payments remain unattributed, and **nothing in this inbox writes financial balances**. SQL definition: `supabase/migrations/pending/paypal_business_webhook_inbox_001.sql`. It has not been applied. Before registering PayPal webhooks, deploy the endpoint and test signature validation using the corresponding sandbox app and webhook registration; do not point a live webhook at an inactive staging route (PayPal will retry deliveries).
