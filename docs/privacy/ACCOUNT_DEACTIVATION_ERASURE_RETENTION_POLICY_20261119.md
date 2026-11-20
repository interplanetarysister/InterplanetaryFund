# IFund account deactivation, deletion and retention policy (proposed implementation, 2026-11-19)

## Two distinct user choices
1. **Deactivate**: reversible account pause, not an account deletion. User can recover access after verified sign-in. Preserve ordinary account data for a maximum 24-month period of continued inactivity, subject to applicable retention and privacy rules. Notify the owner after 18 months and again at least 30 days before expiry; verified reactivation resets the clock. At expiry, initiate a separately authenticated, privacy-compliant account-deletion review rather than silently erasing data or bypassing unresolved legal/financial holds. This is a proposed product rule, not a currently operating inactivity scheduler. Never promise indefinite backups.
2. **Delete account**: verify identity and initiate deletion. Disable account access and revoke sessions as part of the separately verified closure executor. No account is deleted by a request or a read-only preflight.

## Recovery schedule
- A verified, closed account with **no history of funds received, sent, refunded, transferred, or reserved**, and no unresolved disputes: 48-hour recovery grace from effective account disablement.
- A verified, closed account with **any historical money movement**, but no unresolved financial obligations: 30-day recovery grace from effective disablement.
- Pending funds, settlement, withdrawal, refund, chargeback, fraud review, dispute, litigation hold, or unverifiable provider/ledger records: **no automatic erasure**. Continue restricted review until the obligations are resolved; do not classify unknown as zero transactions.
- Recovery requires original verified identity, appropriate security checks, valid policy acceptance and cancellation of the pending erasure. Recoveries after full permanent erasure are not possible; the user may create a new account.

## Separate legal retention
Recovery windows are not financial record deletion schedules. Retain the narrowest required transaction/tax/accounting/AML/dispute evidence separately with strict, purpose-limited access, for the legally applicable duration (often years, depending on record type and applicable jurisdiction), then purge on its own schedule. Never retain the whole social profile merely for accounting. Do not retain payment card details or provider secrets in application archives.

## Release and erasure safety
- New requests may be recorded but do not make anyone automatically eligible for erasure.
- Financial eligibility needs real provider/ledger and account-ownership checks; missing data or errors are a HOLD, never 'no activity'.
- A privileged closure worker must be independently built and tested before real use. It must deactivate/revoke sessions, suspend posting/withdrawals, cancel external OAuth tokens where possible, handle third-party data, private Supabase and R2 objects, beneficiaries/shared campaigns, applicable legal holds, and maintain idempotent audit evidence.
- Notify the verified account owner and offer a way to cancel during recovery grace; do not allow reactivation solely from a still-valid JWT.
- Do not automatically delete the user's content during the recovery grace; prevent public exposure where the closure contract requires it.
- Keep remaining legally retained records pseudonymized or minimally identifying as appropriate, and separately access-controlled.
- Run dry-run and negative authorization checks first. No unreviewed account, financial event, or content may be removed by scheduled jobs.

## Implementation status
The database migration adds only retention-class fields, constraints and a **read-only, super-admin-only** policy assessment RPC. It does **not** implement account disablement, verified financial classification, reactivation, automated purge, or legal-record retention. Do not describe these as operational until verified and deployed.
