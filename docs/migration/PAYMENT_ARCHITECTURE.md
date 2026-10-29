# IFund independent payment architecture — deployment map

Canonical website data project: `ssibsfmtodgximseeqsv` (InterplanetaryFund).
Separate legacy/operations project: `tzehxfikoslihnclhxuz` (Ifund). Do not mix identities or records until reconciled.

## Data and trust boundaries
- Browser: campaign ID, donor-entered gift, optional 10% support consent. No service keys.
- Supabase Edge Function: authenticated or explicitly rate-limited checkout request; validate campaign is active; create PayPal order server-side; persist pending donation record.
- PayPal: order approval, capture and signed webhook notifications. A redirect is never evidence of payment.
- Database: `ifund_donations` uniquely identifies PayPal order/capture and separates campaign gift from optional platform support; `ifund_payment_events` deduplicates verified provider notifications.
- Reconciliation: capture confirmation checks provider order ID, capture ID, currency, amount and campaign association; atomic idempotent transition records settled gift, handles refunds/disputes. Campaign totals derive only from settled gift minus reconciled reversals.
- Withdrawal service: verify beneficiary ownership, payout eligibility and provider approval; apply 3% platform fee only on withdrawal, separately disclose processor fees; immutable audited ledger and idempotent payout execution.
- Public app: campaign-specific donation form and PayPal checkout, never redirect campaign gifts to the separate IFund platform-support link.

## Current state
- Ledger migration applied to canonical Supabase project and RLS/role restrictions verified.
- Checkout frontend and initial PayPal order-creation function staged on isolated GitHub branch.
- **Do not deploy the current order-creation function to live traffic yet**: it lacks verified capture, webhook handling, refund reconciliation, authenticated abuse controls and a tested recovery path for orphaned PayPal orders.
- Frontend build/deployment remains separately prohibited until explicit authorization.
- No production payment acceptance or financial ledger balance is asserted.
