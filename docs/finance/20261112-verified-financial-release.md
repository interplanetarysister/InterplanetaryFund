# Interplanetary Fund — Financial production release checkpoint (2026-11-12)

Issue: #203. Canonical baseline: `interplanetarysister/InterplanetaryFund`.
Scope excludes Base44, the judge sandbox ledger, DNS changes, and live payouts.

## Implemented and deployed

- Signed-in campaign checkout forwards only a Supabase access bearer to the verified server-side ledger broker; the broker validates it against Supabase Auth and persists the immutable donor identity in payment intent and captured receipt.
- Guest gifts stay anonymous; incoming donor UUIDs are never trusted, and mismatched retries fail closed.
- Verified donor receipt history retains refunds, while finance totals and charts count captured, nonrefunded gifts only.
- Production Supabase migrations: `20261112_ifund_authenticated_donor_capture.sql`,
  `20261112_ifund_member_refund_receipt_history.sql`,
  `20261112_ifund_cleared_withdrawal_reservations.sql`. All applied successfully on 2026-11-12.
- Ledger broker `ifund-payment-ledger` Edge Function version **4** deployed.
- Cloudflare `ifund-payments` Worker version `17f16764-1bd3-4a3b-9ed4-8c73b8adc9d9`,
  deployment `dbbe216f-c357-4403-8453-49f0c0009862` with the original bindings inherited strictly.
- Added separately attested provider-cleared capture table, immutable verified-capture check,
  owner-only balance RPC, atomic MFA-gated reservation requests, idempotency keys,
  the existing single 7% withdrawal fee rule and cancellation while under review.
- Home screen platform-support dialog has a more legible PayPal-forward checkout review. The
  hosted link remains *platform support*, not a campaign payment or an IFund campaign receipt.

## Verification and limits

- Cloudflare Pages preview deployment `c7498c25-b1a3-4a47-af36-05b40a411ec6` passed
  the configured command: `npm ci --no-audit --no-fund && npm test && npm run build`.
- Unauthenticated withdrawal and balance RPC negative checks rejected correctly and created
  zero withdrawal, ledger, or clearing records.
- At verification time the live database had 0 donation intents, 0 verified donations,
  0 live ledger rows, 0 withdrawal records, and 0 provider-clearing assertions.
- No live charge, PayPal capture, payout, receipt or webhook event was simulated.
- GitHub Actions checks failed before runner steps; the Cloudflare Pages build did complete.
- **Payouts are not activated.** These changes create *under-review reservations only*.
  Provider-cleared funds require independently verified PayPal settlement/reporting evidence.
  Payment service Payouts approval, eligibility, owner payout-destination validation,
  finalized paid-withdrawal accounting, and real provider settlement are still blockers.
- Never mark `paid` from an MFA result or a synthetic fixture. Recognition of the 7% fee is
  deferred until a legitimately verified payout, and no fee is posted on reservation.

## Next safe work

1. Reconcile live buyer-approved capture and refund evidence directly against PayPal, without
   issuing an unauthorized live charge; prove signed-in My Giving linkage.
2. Add service-only settlement ingestion with provider transaction reconciliation and
   account-level fee allocation, then verify refunds/reservations under concurrency.
3. Implement gated PayPal Payouts execution only when merchant access/eligibility and
   beneficiary verification are confirmed; record provider payout IDs idempotently and post
   net withdrawal plus the single 7% fee only after provider-confirmed payment.
4. Verify role-scoped receipt screens and production deployment before marking #203 complete.
