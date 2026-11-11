# Independent judge-demo sandbox payment test matrix

Last evidence check: 2026-11-11 20:55 UTC. **Never use live PayPal credentials, real instruments, real payouts or fabricated successful captures.** Test only with an authorized PayPal sandbox buyer session. This matrix distinguishes stored historical evidence from a fresh provider-backed run. See [VERIFICATION.md](VERIFICATION.md) and [issue #203](https://github.com/interplanetarysister/InterplanetaryFund/issues/203).

| Scenario | Amount (USD) | Evidence | State | Required next verification |
|---|---:|---|---|---|
| Historical sandbox capture / receipt | 1.00 | Existing completed provider-associated record in isolated demo DB; included in three historical captures totaling $27.00 | Stored consistency verified; no fresh provider lookup | Authorized buyer approval and independent provider Orders v2 GET / capture GET |
| Fractional-cent-sensitive campaign checkout | 2.50 | No fresh capture in this audit | Not provider-verified | Buyer-approved sandbox capture, receipt, ledger exact 250 cents |
| Fractional-cent-sensitive campaign checkout | 3.33 | No fresh capture in this audit | Not provider-verified | Buyer-approved sandbox capture, exact 333 cents and balanced double entry |
| Campaign checkout | 5.00 | No fresh capture in this audit | Not provider-verified | Buyer-approved sandbox capture, exact 500 cents |
| Campaign checkout | 10.00 | No fresh capture in this audit | Not provider-verified | Buyer-approved sandbox capture, exact 1000 cents |
| Campaign checkout | 25.00 | No fresh capture in this audit | Not provider-verified | Buyer-approved sandbox capture, exact 2500 cents |
| Created but not captured orders | 3 orders totaling 3.00 | Existing demo DB rows have status created, no joined captured receipt | Pass: excluded from captured totals | Browser abandon/cancel and eventual expiry lifecycle |
| Ledger double entry | 27.00 historical total | 3 campaign_support entries +2700 cents, 3 sandbox_clearing entries −2700 cents, sum zero | Pass: persisted arithmetic | Cross-check independent provider capture list and financial UI |
| Capture-to-receipt association | Historical 3 captures | 0 captured orders missing joined capture/receipt, 0 noncaptured orders with joined receipt | Pass: stored association | Fresh provider-side verification |
| Campaign association | Historical campaign-purpose captures | 0 captured campaign-purpose orders missing campaign ID | Pass: stored association | Donor/owner role-based UI and authorization checks |
| Production isolation | Historical provider IDs | 0 matching PayPal order/capture IDs in ifund_donations; 0 matching capture IDs in ifund_ledger_entries | Pass for compared columns/tables | Expand to other live ledgers, withdrawals and aggregate totals |
| Unauthenticated finance/payments/admin | N/A | HTTP 401 for /api/finance, /api/paypal/status, /api/admin/tracker | Pass: anonymous denial | Authenticated owner vs other owner vs admin horizontal auth |
| Duplicate capture, concurrent requests, out-of-order signed webhook | N/A | No new provider replay this run | Blocked/unverified | Authorized test buyer, valid signed provider events and idempotency logs |
| Failed/declined, refund, cancellation | N/A | No fresh provider event this run | Blocked/unverified | Sandbox-only provider-backed negative flows, no synthetic receipts |
| Browser/mobile visual | N/A | /discover at 390×844: 85/85 image elements loaded; /hackathon rendered | Pass for media rendering only | Checkout and finance browser journey after Cloudflare browser quota reset |

**Current release reported by deployed /api/status:** `ce7fd0a49ae17f6a95d69b60a65c1400bdf2503e`. No new Worker deployment or new capture in this audit. Test amounts above are coverage targets, not payments made. R2 image provenance remains separately documented in [MEDIA_SOURCE_MANIFEST.md](MEDIA_SOURCE_MANIFEST.md). No 7% withdrawal fee is applied to fictional demo transactions.
