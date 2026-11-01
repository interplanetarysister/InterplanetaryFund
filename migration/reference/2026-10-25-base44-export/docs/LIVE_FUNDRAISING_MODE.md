# Live website and campaign donation mode

## Product contract

Interplanetary Fund remains a published, usable website in both modes.
Registration, campaign creation, public campaign publishing, discovery, sharing,
community participation, and account management are **not** rollout gated.

The admin **Global** FeatureFlag named `public_campaign_fundraising` controls
**new IFund campaign donations**:

- **Off / missing / invalid:** No new campaign Stripe checkout, PayPal or Google
  Pay orders/captures, or manual campaign payment reports. Show the platform-
  support-only notice. The separate official Interplanetary Fund PayPal support
  link remains available, and never credits an individual campaign.
- **On:** Public users can initiate donations to eligible active campaigns
  through independently ready provider rails and existing financial safeguards.
  The platform-support link remains separate and available.

This flag is read from the server during each new campaign payment operation.
Client display state is advisory only and refreshes on focus/visibility change.
The public mode-status endpoint publishes only the boolean and is never cached.

Existing verified donations, donor balances, custody, withdrawal rights,
historical provider settlements, and recovery/reconciliation are unaffected by
the mode. Platform financial truth is provider-verified and server-authoritative.

## Admin procedure

1. Open Admin > Configuration > New Flag.
2. Key: `public_campaign_fundraising`.
3. Label: `Public Campaign Fundraising`.
4. Description: `Allow verified real donations to individual active campaigns.
   Off: platform donations only, while campaigns stay published and usable.`
5. Scope: `Global`. The flag begins **off** when created.
6. Do not enable until live PayPal/Stripe wallet paths, campaign attribution,
   provider reconciliation, donor totals, fee disclosures, merchant business
   ownership, payout settlement, and rollback procedures have been validated.
7. Toggle on to open new campaign payments. Toggle off to stop initiating new
   campaign payments without unpublishing any campaigns.

## Verification requirements before public switch-on

- Build, lint, typecheck, payment contracts, and fundraising-mode contract
  must pass under the repository's supported Node runtime.
- Published app must display the same mode as the backend and update without
  a rebuild; verify on anonymous and authenticated browser sessions.
- With mode off, test donation pages, embedded campaign cards, old deep links,
  Stripe checkout, PayPal order and capture, Google Pay, Cash App manual reports,
  and platform-only PayPal support to ensure no campaign money is accepted.
- With mode on, test small real provider-backed donor payments, unique
  campaign attribution, idempotent capture, canonical ledger, holding ledger,
  donation mirror, donor count, campaign total, refunds/reconciliation, and
  withdrawals, including turning the switch off and back on.
- Confirm financial jobs (existing settlements, receipts, withdrawal accounting,
  webhook reconciliation) keep running when new campaign checkout is off.

## Existing recurring agreements

Stopping **new** checkouts does not automatically pause provider-managed
recurring Stripe subscriptions that were authorized while fundraising was on.
Before turning off fundraising after public recurring donations have started,
the platform must implement and verify an explicit donor-safe provider billing
pause/resume process, with communication and settlement reconciliation.
Do not claim that the OFF mode halts all ongoing provider billing until this
process is verified. Never drop provider-confirmed recurring receipts or hide
existing obligations merely because the switch is off.
