# Independent demo — evidence and compliance gates

Verification date: **2026-11-11**, Pacific. Official Devpost deadline: **2026-11-12 12:00 PST**.

The deployed demo URL is `https://ifund-hackathon-demo.interplanetary-fund.workers.dev/` and the alternate `ifund-demo-ai-check` URL redirects GET/HEAD traffic to it. Reproduce HTTP checks from a clean, unauthenticated browser, not just a privileged account.

## Confirmed by live HTTPS requests

Via PostgreSQL `pg_net` calling the public Cloudflare endpoints:

| Request | HTTP response | Result |
|---|---:|---|
| `GET /` | 200 | HTML shell delivered |
| `GET /api/status` | 200 | sandbox, AI/payments/media/storage configured |
| `GET /api/campaigns` | 200 | published fictional campaigns returned |
| `GET /api/session` (no cookie) | 200 | `user: null` |
| `GET /api/paypal/status` (anonymous) | 401 | access denied |
| `GET /api/admin/tracker` (anonymous) | 401 | access denied |
| `GET /api/campaigns?mine=1` (anonymous) | 401 | access denied |
| `POST /api/paypal/webhook` without PayPal signature | 400 | signature headers required |

HTTP tests **do not establish visual accessibility, browser scripting or actual buyer interaction**.

## Confirmed by read-only Supabase database inspection

At inspection, isolated `ifund_demo_*` tables contained 10 demo users, 10 fictional campaigns, 3 sandbox order intents, 1 receipt, 1 webhook event, 13 logged AI attempts, and 20 tracker gates.

- One order marked `captured` has a matching `COMPLETED` capture of **USD $1.00**, one sandbox receipt, and **two** ledger entries netting to **zero**.
- The event table has one signed-event record with delivery count > 1, evidence of a deduplicated replay in stored state. A fresh provider redelivery test was **not** performed as part of this audit.
- Four most recent AI invocations were marked **succeeded** for `titles`, `descriptions`, `story`, and `section`, using `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.
- Two order intents remain `created`; neither is counted as a successful donation.

## Still unverified — do not claim acceptance

- Fresh end-to-end PayPal sandbox buyer approval on the public judge URL, provider-side order/capture lookup, refund, cancellation, and abandoned checkout
- Actual model response content in a browser; AI image generation and upload moderation
- Admin/organizer ownership and horizontal authorization negative tests
- Browser/mobile visual testing and screen-reader accessibility
- Signed webhook spoof/replay across all scenarios and capture concurrency races
- Public YouTube demonstration showing actual screen footage, under 3 minutes, included on Devpost
- Current Devpost submission fields and final acceptance receipt

**No live donations, live platform totals or real withdrawals should be represented as sandbox evidence.** Explicitly label all fictional campaigns, receipts and totals.

## Official submission checklist

- [x] Public repository and AGPL-3.0 root license
- [x] Hosted demo endpoint responds to read-only HTTP probes
- [x] PayPal and Workers AI integration present in deployed executable
- [x] One isolated completed sandbox payment record, matching receipt and balanced ledger
- [x] Four successful AI generation records
- [x] Anonymous route authorization and unsigned webhook negative checks
- [ ] Independent fresh provider capture confirmed during judging readiness review
- [ ] Functional guest/buyer/admin browser walkthrough from a clean device
- [ ] Complete source-build instructions verified from a fresh clone
- [ ] Public unedited screen-recording video under three minutes
- [ ] Final Devpost entry/YouTube URL and submission receipt verified

See the [official rules](https://paypalaihackathon.devpost.com/rules). Compliance is not certified by these tests.
