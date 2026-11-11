# iFund PayPal Hackathon Demo Tracker

This workspace is integrated into the existing iFund PayPal Hackathon page at `/hackathon/tracker` (organizer-only) with a navigation link from the public `/hackathon` demo.

## Security and architecture
- Original Cloudflare Pages/Workers frontend and existing Supabase project. No additional site, API, payment provider, or backend.
- `public.ifund_hackathon_demo_steps` stores **manual tracking metadata only**. Authenticated access is guarded by the existing verified super-admin RPC through RLS. Anon and ordinary members are denied. No client-side credentials or public payment data.
- Sandbox orders and webhooks continue to use their existing isolated tables. Their receipt data are not automatically treated as real gifts, ledger entries or public totals.
- Evidence and screenshots are **HTTPS links** to already-controlled storage, not uploads into a new service. Never paste credentials, secrets, PII or private payment details.
- Status changes are manual attestations. Completion requires an evidence URL and test result, and still does not assert independent provider verification.
- `revision` is used for optimistic concurrency; edits do not silently overwrite each other.
- No changes to sandbox feature flags, live payments, production DNS, Base44 or payout permissions.

## Usage
1. Open `/hackathon` for the judge demo. The organizer-only link leads to `/hackathon/tracker`, protected by Supabase login and existing verified super-admin authorization.
2. Filter by demo flow or status, select a step, enter result, evidence and screenshot URLs, commit SHA, preview URL, deployment notes, blocker and next action.
3. Save each step; an unknown step stays unknown until explicitly changed.
4. Generate/copy/download the Markdown readiness report and review incomplete gates. Do not send it to judges as proof until actual provider-backed evidence has been verified.
5. Refer to `docs/hackathon/JUDGE_TESTING.md` and `docs/hackathon/PAYPAL_2026_COMPLIANCE.md` for exact technical criteria.

## Verification
Run `npm test` from `apps/web`. The targeted `tests/hackathon-tracker.test.js` covers stable IDs, unknown preservation, evidence validation, and report status. Verify RLS and the existing route with a real preview smoke test before claiming deployment readiness.
