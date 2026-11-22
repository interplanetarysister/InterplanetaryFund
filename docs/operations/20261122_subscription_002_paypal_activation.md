# PayPal subscription-002 integration checkpoint — November 22, 2026

**Owner-supplied PayPal button factory:** `P-8RG59105D5286480MNMBOKJA`.
Public PayPal SDK client ID was supplied with `vault=true&intent=subscription`.
This establishes the intended plan reference, **not** that PayPal's active recurring
price, currency, merchant, product and webhook signing have been independently
verified. Do not save, log or reprint PayPal secrets here.

## What was connected

- iFund's source payment Worker now expects **Basic monthly = $4.99 USD** and
  `P-8RG59105D5286480MNMBOKJA`. It validates the *actual live PayPal plan*
  using the existing `exactBasicPlan` routine: status ACTIVE, recurring
  MONTH schedule, fixed $4.99 USD price, product ID and billing cycles.
- Supabase `public.ifund_subscription_plans` now points its **inactive**
  Basic/monthly catalog entry to the new plan; stale product and webhook
  verification are cleared. The migration refuses to change a verified plan,
  an account with existing subscription intents, or a conflicting merchant
  mapping. No payment events or subscription receipts were modified.
- The web catalog uses the name **Interplanetary Fund Premium**. Authenticated
  subscription checkout still passes through iFund's own signed ledger,
  server-initiated provider subscription, verified webhook reconciliation,
  member identity checks and cancellation endpoints.
- The arbitrary PayPal button factory's `onApprove` alert is **never** used
  to grant premium access. That standalone button would create subscriptions
  without iFund's `subscription_begin` intent, custom ID and bound provider
  subscription. Subscriptions created outside iFund's flow cannot be safely
  imported by merely pasting their IDs into a profile.

## Activation blockers (do not claim subscribers can pay through iFund yet)

1. PayPal plan retrieval from the configured, correct **live merchant account**
   must prove the supplied plan ID, ACTIVE status, $4.99 USD monthly rate,
   correct merchant and product details. Owner-provided JavaScript alone
   cannot prove any of these.
2. The separate deployed `ifund-payments` Worker needs updated code and its
   existing secret-store bindings preserved. Do not assume a Pages build deploys
   a separate Worker.
3. The current payment Worker settings have **no**
   `IFUND_SUBSCRIPTION_ATOMIC_ENABLED` binding. Subscription enrollment
   therefore deliberately fails closed until the signed-ledger readiness
   contract is installed and accepted. Require verified webhook event coverage
   and actual signed test receipts before enabling.
4. Premium's new advertised benefits—**50 shared AI creations per billing
   month and unlimited agent chat under infrastructure/fraud safeguards**—must
   be implemented and tested before marketing claims become available in
   checkout. The currently deployed agent daily quota and paid image rolling
   seven-day allowance do not meet those new promises.
5. Mobile App Store and Play policies still need independent billing-route
   acceptance. Do not enable website PayPal subscriptions from a native
   mobile purchase screen before store-compliant implementation.

Do not perform fake payments or grant subscriptions on PayPal authorization
alone. No automatic payments should be triggered by the 24-hour signup trial.
