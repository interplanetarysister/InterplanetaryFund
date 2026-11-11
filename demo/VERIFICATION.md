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

## Fresh browser media and ledger audit — 2026-11-11, ~20:45–20:55 UTC

- **Deployed endpoint:** `https://ifund-hackathon-demo.interplanetary-fund.workers.dev`; public `GET /api/status` returned 200 and `release_sha=ce7fd0a49ae17f6a95d69b60a65c1400bdf2503e`. This is the Worker-reported deployment SHA, not proof that GitHub main and Worker match.
- **Mobile browser:** Cloudflare Browser Rendering loaded the real `/discover` React page at **390×844**, waited for images and inspected the browser's `HTMLImageElement.complete` and `naturalWidth` properties. **85/85 image elements loaded; 0 broken; 0 pending** in that rendered page. This is browser image loading evidence, not a screen-reader, licensing, layout/crop, or authenticated checkout acceptance test. The `/hackathon` mobile route also rendered without a detected error banner.
- **Image repair:** Direct original `https://upload.wikimedia.org/wikipedia/commons/6/64/Emergency_shelters.jpg` returned HTTP **429** in a fresh request. A constructed 640px thumbnail returned **400** (unsupported thumbnail size). The 960px thumbnail `https://thumb.wikimedia.org/wikipedia/commons/thumb/6/64/Emergency_shelters.jpg/960px-Emergency_shelters.jpg` returned **200 image/jpeg** (145858 bytes). Eight `fictional=true` sandbox campaign records previously referencing that exact original URL were updated to the verified 960px URL, with `updated_at` and version increment. This is a delivery fix only; source photographer/license attribution remains as recorded in `MEDIA_SOURCE_MANIFEST.md`. No real campaign records were changed.
- **API follow-up:** Public `GET /api/campaigns` returned 200 and **83 campaigns**, 0 blank image paths, 81 Wikimedia references, two existing `/api/media/` paths, eight updated shelter-image references. Unauthenticated `/api/paypal/status`, `/api/finance`, `/api/admin/tracker` each returned **401**; `/api/session` returned 200 with `user:null`.
- **Sandbox ledger read-only checks:** `ifund_demo_orders` contained **three captured orders totaling 2700 USD cents** and three still-`created` orders totaling 300 cents. Three receipts and three webhook event records exist. `ifund_demo_ledger` had three `campaign_support` credits totaling **+2700 cents** and three `sandbox_clearing` debits totaling **−2700 cents**; overall balance **0**. No captured order lacked its joined capture/receipt; no noncaptured order had a joined receipt; no captured campaign-purpose order lacked a campaign association (all zero). These are persisted database consistency checks **not new PayPal provider lookups or buyer-approved transactions**.
- **Production isolation cross-check:** zero PayPal order-ID matches in `ifund_donations`, zero capture-ID matches in `ifund_donations`, zero capture-ID matches in `ifund_ledger_entries` against the demo provider records. This covers the three compared columns/tables, not every possible live financial data path.
- **Rate limits:** further Cloudflare browser-render requests returned HTTP **429**. Stop repeated browser attempts until quota resets. `/create`, `/checkout`, and `/finance` authenticated visual journeys remain unverified.
- **No new payment, capture, refund, withdrawal or webhook was generated** during this run. Do not count fictional campaign activity as provider-backed payment evidence. Fresh authorized PayPal sandbox buyer approval and provider reconciliation, duplicate/concurrent webhook tests, cancellation/refund and the requested $2.50/$3.33/$5/$10/$25 cases remain pending. No production DNS, live payments or Base44 changes.

## Submission confirmation and reconstructable Worker source — 2026-11-11

- **Submission exists:** A Devpost confirmation for **Interplanetary fund / PayPal AI Hackathon**, dated November 4, 2026, was located in the entrant's connected account. Submission ID `1238781`, project `interplanetary-fund`. This is evidence of submitting an entry, **not** independent verification of each current Devpost form field, current video URL, eligibility acceptance, or sponsor-prize selections. The public submission URL may redirect unauthenticated readers to login.
- **Entrant classification review is open:** Devpost asked whether the entrant is participating as an individual or representing an organization because the entry contained both types of information. Entrant must respond truthfully via Devpost; neither a correction nor a Devpost response is claimed here.
- **Authored Worker source recovered:** The live deployed Worker download includes `index.js.map` with embedded original TypeScript `sourcesContent`. Five original `worker/*.ts` source modules and `src/sandbox-liability.ts` have been restored in `demo/`. Worker type contracts were reconstructed in `demo/worker/types.ts`; a separate `demo/package.json`, TypeScript configuration, and a build workflow now provide a fresh-source build path. The original authored React frontend source is still missing, and the source-build CI must pass before claiming full reproducibility. The bundled frontend assets and original deployed Worker snapshot remain available.
- **Read-only judge acceptance runner:** `demo/scripts/judge-acceptance.mjs` now exercises the real demo's public shell/assets, 83 fictional campaigns/image references, sandbox config, anonymous account and protected routes. This runner was committed but **not successfully executed from a fresh external Node runtime** in this engineering session; the container cannot resolve the public host. Equivalent selected routes have been verified using live HTTPS via Supabase `pg_net` and actual Cloudflare mobile browser rendering.
- **Mobile browser images:** `/discover` was successfully rendered at 390×844 with **85/85 image elements complete and nonzero naturalWidth**, 0 broken/pending. The public `/hackathon` guide also rendered on mobile. The full authenticated AI, PayPal buyer, admin/finance and creation routes remain unverified; browser-rendering rate limits interrupted additional coverage.
- **Source/deployment distinction:** Publishing TypeScript files to main does not deploy them to the Worker. Actual Worker status earlier exposed `release_sha=ce7fd0a49ae17f6a95d69b60a65c1400bdf2503e`. Documented code and deployed hashes may differ until explicitly rebuilt and deployed.
