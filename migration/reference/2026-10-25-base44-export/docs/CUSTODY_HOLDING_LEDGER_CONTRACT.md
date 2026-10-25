# Interplanetary Fund custody and holding-account contract

Interplanetary Fund is designed to present one platform balance while preserving exact beneficial ownership underneath it.

## Current holding account

The current designated holding account is the **Interplanetary Fund business PayPal account**. The repository's canonical PayPal donation configuration identifies that business account as `cuddlemeplatonically@gmail.com`. Live PayPal Business REST credentials used for IFund donation orders, captures, transaction reporting/reconciliation, holding-account custody, subscriptions, and payouts must belong to or be expressly authorized for this designated business account. The email in configuration is not itself proof that the live PayPal credentials point to that merchant. Consumer/personal account labels returned by external finance aggregators are diagnostic only and must never choose or override IFund's holding account.

For the current implementation, “held / settled” therefore means funds whose receipt into that designated business PayPal account has been independently verified by PayPal. A donation observed on an exterior platform is not held merely because Interplanetary Fund can see it. Exterior funds must actually be transferred/payout-settled into the designated Interplanetary Fund business PayPal account, and the receiving PayPal transaction must be reconciled to the originating campaign/user ledger allocation.

The holding-account designation is configuration, not proof of a transaction. Code must never mark funds settled solely because the configured PayPal account exists. New checkout orders explicitly name the designated payee; any mismatch or PayPal rejection must block that new order instead of rerouting a payment. Preexisting orders and receipts from a different merchant must be separately reviewed against their original receiving account; changing the designation does not transfer or rewrite historical funds.

## Verified PayPal donation reconciliation checklist

- Validate the donor-entered provider charge and the complete post-processing allocation before creating an order. After a provider reports a successful capture, do not reapply the donor minimum to the smaller post-fee allocation; preserve the receipt and enter reconciliation on any genuine metadata conflict.
- Claim a canonical donation with Base44's atomic keyed `upsert`. Bind the key to an immutable allocation fingerprint (campaign, owner, provider transaction, gross allocation, contribution, processor fee, and normalized payment channel). Equal retries converge; different allocations retain evidence and fail closed for review.
- Treat `Campaign.raised_amount` and `donor_count` as projections of verified `Donation` mirrors. Re-read and rewrite with a bounded convergence loop after the mirror exists; fail explicitly when writes remain unstable.
- A provider receipt is fully tracked only when its applied canonical operation, verified donation mirror, and settled holding entry all exist, agree on one campaign, and share the canonical operation id. Any same-campaign partial state is repairable and must remain visible to recovery. Cross-campaign or amount conflicts must not be reassigned automatically.
- A PayPal holding entry is atomically claimed by `operation_key`, then re-read and accepted only when exactly one row matches the provider transaction, campaign, amount, processing fee, platform contribution, currency, and canonical operation. Recovery may converge duplicate holdings only when every immutable allocation field agrees.
- Partial capture recovery inherits the immutable platform contribution and payment channel from consistent existing canonical/mirror/holding evidence. It defaults contribution to zero and channel to PayPal only when the receipt has no prior local allocation evidence.
- Generic canonical donation recording must never fill a missing legacy payment channel from caller arguments. Legacy backfill is allowed only in the dedicated recovery path, after exactly one allowed channel is independently present in persisted Donation/Holding evidence and all provider, campaign, transaction, amount, fee, and contribution fields agree. Otherwise fail closed for manual review.
- Bind every provider request identity to campaign, donor-entered total, payment channel, and optional platform-contribution choice. Rotate the identity whenever any bound field changes.
- Donor-facing estimates must name the actual rail and use that rail's processor fee model. The Interplanetary Fund fee remains 3% of the campaign gift at withdrawal, never a checkout processor fee.

## New gift-first donation quotes (October 15, 2026 proposal)

- The entered amount is the **campaign's pledged gift**, not the charge total.
- A donor who opts in to support Interplanetary Fund adds 10% of the pledged gift to the payment total, not deducted from the campaign's gift.
- The processor's estimate is added as an explicitly displayed, separate amount. Provider-approved total must equal the amount shown in the applicable payment sheet.
- The 3% IFund fee is applied exactly once at withdrawal and disclosed to the campaign owner in the withdrawal breakdown; donor checkout does not pre-deduct or display it.
- New PayPal order metadata includes a gift_first_v2 version marker. Prior five-part metadata and existing canonical receipts retain their historical calculations without migration.
- If a verified provider receipt cannot cover the promised gift, do not post a false donation or silently reduce the gift: retain receipt evidence for financial reconciliation. Never auto-retry a completed charge.
- Cash App sends funds to a creator-controlled account; IFund cannot collect a platform tip on that path and must not deduct one from a manually reported amount.

## Financial states

1. **External observed** — money reported by a connected crowdfunding/provider account. This is informational and is not Interplanetary Fund-held or withdrawable.
2. **Transfer pending** — an external provider has initiated movement toward an Interplanetary Fund-controlled settlement account, but receipt is not yet independently confirmed.
3. **Held / settled** — the payment processor or bank has independently confirmed that Interplanetary Fund controls the money. Only this state may increase held and withdrawable balances.
4. **Reserved** — settled money has been locked to a withdrawal and cannot be spent or withdrawn twice.
5. **Paid** — the withdrawal provider confirms payout to the beneficiary.
6. **Reversed / failed** — a transfer or payment did not settle or was reversed; balances must be reconciled without manufacturing value.

## Ledger allocation

Every settled movement must retain:

- stable idempotency / canonical operation identity;
- source provider and provider transaction/settlement reference;
- campaign id;
- beneficiary user id;
- amount and ISO currency;
- platform contribution and processor fee;
- withdrawal id when applicable;
- external connection/observation linkage when the money originated outside Interplanetary Fund;
- settlement timestamp and reconciliation state.

A pooled physical account does **not** mean pooled ownership. The sum of campaign/user liabilities plus platform-owned amounts must reconcile to the verified funds actually controlled by Interplanetary Fund, by currency. Money belonging to one campaign/user must never satisfy another campaign/user withdrawal.

## External-platform rule

Syncing or observing a GoFundMe, Ko-fi, Kickstarter, Indiegogo, GiveSendGo, FundRazr, Patreon, Buy Me a Coffee, or other external balance does not move money. An external balance becomes held only after that provider (or the receiving processor/bank) supplies verifiable settlement evidence into an Interplanetary Fund-controlled account. Where a provider does not support programmatic transfer, the platform must report the balance as external/pending rather than pretending it was moved.

## Access boundary

Custody ledgers, treasury snapshots, provider references, and platform-wide balances are admin-only. User-facing balance endpoints may expose only the authenticated user's/campaign's allocated balance and sanitized transaction history.

## Invariant

**Physical funds held >= total user/campaign liabilities + reserved liabilities, per currency**, after accounting for processor fees, platform contributions, completed payouts, reversals, and legally permitted platform fees. Any reconciliation failure must fail closed: block new withdrawals for the affected funds until resolved.
