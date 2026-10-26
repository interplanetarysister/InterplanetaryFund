# Interplanetary Fund — Feature flag implementation and verification

Date: 2026-10-08
Target: current Base44-backed user-facing application.
Source: branch `feature/verified-feature-flag-integration`.
Launch policy: the published site remains usable for campaigns and sharing even
when public campaign donations are paused. No real payment/transfer is initiated
by repository contract tests.

## Classification

| Key | Source integration | Verification completed | Outstanding live check |
| --- | --- | --- | --- |
| new_campaign_publishing | Always available; must not be flagged | Source invariant | Published page and campaign test |
| public_campaign_fundraising | Backend gate from prior repair | Source, regression | Merchant checkout, canonical totals, custody, payouts |
| payment_checkout_enabled | New campaign checkout paths | Source, regression | Real checkout start on each rail |
| paypal_checkout | PayPal new order only; not completed capture | Source, regression | Live business account order/capture/reconcile |
| stripe_checkout | New Stripe checkout | Source, regression | Live Checkout and webhook |
| google_pay_checkout | PayPal Google wallet new order + UI | Source, regression | Eligible real device/browser wallet capture |
| recurring_donations | New recurring Stripe checkout only | Source, regression | Live signup, renewal, cancel/pause after mode OFF |
| subscription_checkout | New Stripe paid-plan checkout | Source, regression | Active subscription, entitlement, cancellation |
| outbound_payout_execution | Before new payout request/approval | Source, regression | Real merchant payout, held review, provider uncertainty |
| ai_campaign_assistant | Two server AI endpoints, client story & coach | Source, UI | SDK integration costs/auth and model generation |
| ai_outreach_agent | Scheduled runner / user enable UI | Source, regression | Scheduler, entitlement, consent, generated artifacts |
| social_autopilot | Scheduled runner | Source, regression | Scheduling/provider posting + opt-out |
| cross_platform_publishing | Owner publish, broadcast & scheduled queue | Source, regression | Verified per-provider posting and retries |
| managed_connections | New delegated-action initiation | Source, regression | Browser transport deferred, provider OBO approval |
| external_campaign_import | Owner-scoped import function | Source, regression | Provider snapshot quality & real import |
| external_fund_collection | New collection preparation | Source, regression | Real provider transfer/settlement; planning != custody |
| external_feed_mirroring | Scheduled external feed read | Source, regression | Live approved provider reads & owner consent |
| community_creation | Backend create & UI | Five mocked handler tests include success/OFF/rollback | Live Base44 owner and membership round-trip |
| institution_programs | Registration, opportunity, application & UI | Mocked creation + source | Live RLS, listing, application & review |
| admin_agent_execution | Existing admin-execution runtime not attached to flag | Existing boundary source tests | Verify working gateway, agent completion and approvals |

Three existing records must never gate platform access or financial truth:
`new_campaign_publishing`, `public_campaign_publishing` and
`paypal_donation_reconciliation`. Retired key
`outbound_payout_executiin` must not be enabled. The original misspelled
`ai_campaign_asisstant` was normalized in Base44 data (OFF) to
`ai_campaign_assistant`, and the PayPal rail scope to `beta`.

## Enforcement rules

- Missing, duplicated, mis-scoped and unavailable flags fail closed.
- A flag does not grant authorization, user consent, subscriptions, provider
  permissions, access to funds, or external API capabilities.
- New PayPal/Google orders respect the feature flags; *already initiated orders*
  can still complete capture and verified ledger reconciliation if switches turn
  off before the buyer returns. Stripe webhook callbacks and pending provider
  settlements remain independent.
- Existing recurring donation subscriptions are NOT paused by turning OFF the
  new recurring checkout flag or public campaign fundraising. Provider-specific
  billing pause/cancellation must be implemented and tested before claiming a
  global pause of ongoing payments.
- The connection sync worker still verifies connection health when outbound
  publishing is disabled; it simply skips the publish queue.
- Emergency payout OFF must never block provider payout reconciliation, donation
  verification, ledger visibility, or safe reservation releases; users must
  retain the ability to reclaim funds under the platform's payout obligations.
- No feature can be called live-verified from source-code presence alone.

## No invented completion

Sandbox TypeScript checks, lint, Vite build, contract tests and mock handler
tests are local evidence only. End-to-end provider/payment, Base44 hosted branch
deploy, and merchant account checks are still required. Do not enable external
money or agent action flags merely because the source passes static tests.

## Required next certification

1. Sync verified changes into the authoritative deployed Base44 app and rerun
   checks in its supported Node 22 environment.
2. Verify two-way flag reads and writes for admin, anonymous, and regular users
   from the published origin, including disabled/unsupported statuses.
3. Confirm each internal feature via owned test records in the Base44 QA
   environment with cleanup (do not create fake public campaigns or donations).
4. Provider-admin/merchant authorizations and live low-value financial tests:
   PayPal business REST, Stripe/Google Pay, webhooks, fee ledger, duplicates,
   campaign totals, idempotent recovery and payout.
5. Test social/provider connectors using authorized accounts and supported
   official APIs; never treat an owner-reported external amount as settled funds.
6. Implement the deferred browser/managed-connection route with safe URL policy,
   session custody, cost accounting and opt-in; verify before calling it ready.
7. Implement any actual external-fund transfer API path; current workflows plan
   and record authorizations but have no provider-verified transfer execution.
8. Check the admin agent gateway, its actual execution runtime, tool approvals
   and completed artifact before enabling `admin_agent_execution`.
