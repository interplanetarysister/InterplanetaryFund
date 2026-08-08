# Interplanetary Fund — Payment System
**Version:** 1.0.0

## Payment Methods
1. *PayPal* — Checkout flow via convex/paypalCheckout.ts, webhook via convex/paypalWebhook.ts
2. *Stripe* — Checkout flow via convex/stripeCheckout.ts, webhook via convex/stripeWebhook.ts
3. *CashApp* — $cashtag stored on campaign, manual payment path

## Treasury Architecture
- Holding accounts track gross (pre-fee) and net (post-fee) balances
- Fee config table manages platform fees
- Payout requests with withdrawal methods
- Campaign ledger tracks per-campaign financial movements
- Fund consolidation runs automatically every 6 hours (credit-free cron)
- Financial audit log records all financial events
- Provider transactions track external payment provider records

## Security
- Secure withdrawal system (convex/secureWithdraw.ts)
- Fraud control (convex/fraudControl.ts)
- Campaign freeze system for unverified ownership
- Admin PIN required for sensitive operations

## Key Files
- convex/paypalCheckout.ts — PayPal payment initiation
- convex/paypalWebhook.ts — PayPal webhook handler
- convex/stripeCheckout.ts — Stripe checkout session creation
- convex/stripeWebhook.ts — Stripe webhook handler
- convex/treasury.ts — Treasury management
- convex/secureWithdraw.ts — Secure withdrawal processing
- convex/simpleWithdraw.ts — Simple withdrawal
- convex/withdrawalMethods.ts — Withdrawal method management
- convex/paymentProviders.ts — Payment provider configuration
- convex/campaignLedger.ts — Campaign financial ledger
- convex/fundConsolidation.ts — Fund consolidation engine
- convex/financialAudit.ts — Financial audit functions
- convex/fraudControl.ts — Fraud detection and control

## Status
- PayPal: Live and functional
- Stripe: Live, webhook verified (alert confirmed 2026-08-07)
- CashApp: Configured per-campaign
- Treasury: Operational with auto-consolidation
- Payouts: Available via admin panel
