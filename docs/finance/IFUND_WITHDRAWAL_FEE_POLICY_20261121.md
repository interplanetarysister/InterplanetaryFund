# Interplanetary Fund — Current Withdrawal Fee Policy

**Effective:** 2026-11-21  
**Applies to:** first-party IFund campaign donations and campaign-owner withdrawals

## Donor checkout

- The donor's selected campaign gift is not reduced by the IFund withdrawal fee.
- Any optional IFund platform-support contribution is a separate add-on, calculated on top of the campaign gift when the donor selects it.
- Provider processing costs are handled separately from the IFund withdrawal fee.
- IFund does not apply its campaign withdrawal fee to external provider gifts or direct Cash App transfers. External direct transfers are not verified IFund captures and must not update verified campaign totals or the IFund donation ledger.
- Donations made directly to IFund's platform-support flow are separate from campaign gifts and do not incur the campaign-owner withdrawal fee.

## Campaign-owner withdrawal

- The current IFund fee is **3% of eligible, provider-cleared campaign gift funds**, calculated when the owner requests withdrawal.
- The fee is reserved with the withdrawal request and becomes realized platform income only after PayPal confirms the payout item as `SUCCESS`.
- The fee is not added to the donor's checkout total and is not charged a second time.
- Optional platform-support contributions are not included in the campaign-gift fee base.
- The UI must show the current 3% estimate for new withdrawals and the recorded fee rate for historical withdrawal rows.

## Historical accounting compatibility

The previous implementation used a 7% withdrawal rate. The new migration records a `platform_fee_bps` value on each withdrawal so historical rows, if any were created before migration, retain their original rate. The 700-basis-point value is grandfathered for historical accounting only; every new withdrawal request explicitly records **300 basis points (3%)**.

At the read-only production schema audit for this change, `ifund_finance.withdrawal` contained zero rows. The migration still includes a guarded historical backfill so it will preserve any valid pre-migration 3% or 7% records if one is created before the migration is applied. Unrecognized fee amounts stop the migration rather than being silently rewritten.

## Implementation references

- `supabase/migrations/20261121200000_ifund_three_percent_withdrawal_fee.sql` — database constraint, recorded rate, owner finance estimate, reservation, payout validation and realized ledger note.
- `apps/web/src/lib/withdrawalFeeQuote.mjs` — integer-cent 3% estimate.
- `apps/web/src/lib/budgetPlanning.mjs` — 97% net planning estimate.
- `apps/web/src/pages/WithdrawalVerification.jsx` and `apps/web/src/pages/AdminFinance.jsx` — fee display; historical rows derive their displayed rate from recorded gross and fee amounts.

**Deployment status:** migration is committed to the feature branch but has not been applied to the production database. Production remains subject to the full route, security, build and preview acceptance gates.
