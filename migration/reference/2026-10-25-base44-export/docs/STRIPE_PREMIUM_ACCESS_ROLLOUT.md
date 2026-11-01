# Stripe premium-access rollout (2026-10-08)

Source: GitHub main, merged PR #498 (38b93c1). This document contains identifiers, not secrets.

## Verified live catalog
- Stripe IFund account: acct_1TxdGsGg5Dyxp347
- $12/month Basic AI: price_1UOFDfGg5Dyxp347qGlvjDcY
- $1 nonrenewing 24-hour Basic day pass: price_1UOFDgGg5Dyxp347qHsT4r7m
- 50% first-month Basic coupon: eTE4pUPM
- New accounts can activate a one-time, card-free 3-day Basic trial without automatic renewal.

## Security behavior
- Stripe day-pass entitlements activate only after a signed webhook, a fresh Checkout Session lookup, successful PaymentIntent lookup, and exact price/amount verification.
- Pass duration is calculated from the Stripe payment success event timestamp; refunds/disputes revoke the matching pass.
- Trial and day-pass expiration are evaluated in client and backend entitlements.
- Subscription renewals/cancellations are bound to the verified Stripe subscription ID.
- Stripe and PayPal donations remain separate from AI service purchases.

## Release gates still to satisfy
1. Configure the existing IFund live Stripe merchant key as a Base44 secret, never as client code.
2. Register a deployed IFund /functions/stripeWebhook URL with signed events: checkout.session.completed, checkout.session.async_payment_succeeded, invoice.paid, customer.subscription.updated, customer.subscription.deleted, charge.refunded, charge.dispute.created.
3. Store its matching Stripe webhook signing secret as STRIPE_WEBHOOK_SECRET in Base44 secret storage; never put this secret in GitHub or user-facing output.
4. Verify signed event delivery and Stripe merchant charge readiness, and keep subscription_checkout disabled until confirmation and entitlements pass end-to-end tests.
5. Verify Base44 deployment, public checkout, cancellations, trial expiration and day-pass expiry with non-charging test procedures before enabling public billing.

No customer charges, subscriptions, payouts or donations were initiated by the catalog setup or code work.
