# PayPal AI Hackathon — single completion and truth-in-submission checklist

**Audit date:** 2026-11-11 (Pacific)  
**Submission cutoff:** 2026-11-12 12:00 PM Pacific.  
**Official rules:** https://paypalaihackathon.devpost.com/rules  
**Candidate judging URL:** https://ifund-hackathon-demo.interplanetary-fund.workers.dev/  
**Alternate redirect:** https://ifund-demo-ai-check.interplanetary-fund.workers.dev/  
**Submission claim reference:** [DEVPOST_SUBMISSION.md](DEVPOST_SUBMISSION.md)  
**Evidence:** [VERIFICATION.md](VERIFICATION.md)

## Status legend

- [x] Independently evidenced by repository or documented provider-side/database checks (limited to exact evidence).
- [ ] Not yet independently accepted. Existing code or records do **not** automatically prove user-facing functionality.

## P0 — mandatory functional gates and submitted promises

- [x] Public source repository with root AGPL-3.0 LICENSE.
- [x] Standalone demo has read-only HTTP evidence for its public shell and campaigns API. **Not a browser journey pass.**
- [x] Independent demo evidence log records a completed $1 PayPal sandbox capture, isolated receipt, balanced two-entry ledger, and a deduplicated webhook event. **Historical database evidence only; requires fresh provider verification before promising reproducible checkout.**
- [x] Independent demo evidence log records successful Cloudflare Workers AI inference requests for title, description, story and section. **Not yet tested end-to-end in the judge browser.**
- [ ] Clean-browser access: actual app renders, assets load, navigation functions, mobile widths work; screenshot + UTC time + deployment hash.
- [ ] Demo login and role-specific authorization: guest, disposable donor, organizer and admin access; no public credential disclosure, no horizontal data access.
- [ ] Fresh live Workers AI invocation via judge UI generates **five titles**, **two descriptions**, **one full story**, and individual section regeneration; record redacted response and model evidence.
- [ ] Campaign draft save, edit, publish, public discovery, and state persistence; clearly label every showcase campaign FICTIONAL/DEMO.
- [ ] New PayPal sandbox purchase from a buyer **different from merchant**: order create -> provider-hosted sandbox approval -> return -> server-side Orders v2 capture -> provider reconciliation -> exactly one isolated receipt/ledger pair.
- [ ] Signed PayPal capture webhook validation, duplicate replay isolation, spoofed/unsigned rejection, concurrent capture idempotence, cancel/abandon failures; verify no real donations/totals change.
- [ ] Show the same confirmed sandbox receipt in donor, organizer and admin finance screens; test owner-only financial access and displayed source distinction.
- [ ] One reliable canonical entry URL links actual campaign, AI, PayPal and finance operations without dead ends or confusion; any example-only material explicitly says SAMPLE, not live provider data.
- [ ] Verify screenshot/video proof of actual app (not static mockup), English narration/labels, public YouTube video <3 minutes, and playable incognito.
- [ ] Complete Devpost **PayPal AI Hackathon** entry with correct demo URL, repo, tool disclosure, material post-Oct-1 updates and YouTube link; retain submission confirmation URL/receipt and time before deadline.
- [ ] Judges can freely test without paid credits or actual money through judging ending December 15; provide safe sandbox credentials privately where needed.
- [ ] Fresh-clone reproducibility: complete authored source + assets + build commands and required environment setup without committing secrets. The compiled Worker export alone is **not** adequate first-principles source-build proof.

## P1 — additional features mentioned in other iFund plans / judge materials

These are NOT automatically part of the actual PayPal Devpost submission. If they appear in current Devpost text or demonstration, each must be verified or the claim must be corrected **before submission**.

- [ ] Interactive campaign location globe: confirm real geographically grounded campaign pins, verify the intended APGraph implementation, consistent routes and mobile behavior.
- [ ] Donut charts and other metric panels: ensure rendered, interactive when promised and accurately sourced. Example metrics must be labeled fictional.
- [ ] AG Grid Community dashboard: actual grid renders in judge demo; sorting/filtering/export work; financial values cannot be mistaken for verified payments. Distinguish from independent sandbox financial views.
- [ ] Postman sponsor claim: retain actual Postman/Newman run results, not just an imported collection or authored test plan.
- [ ] Share/connect/cross-post integrations: distinguish interactive preview and copy-to-clipboard from actual provider-authorized external publishing; independently verify at least one cross-post if claiming it.
- [x] Guided demo **implemented and deployed**: seven actual sandbox routes, numbered concise steps, highlighted real controls, Back/Continue/Skip/Restart and zero synthetic payment actions. Instructions sit in a separate desktop sidebar/mobile bottom section so they cannot overlay highlighted elements. Deployed route: [`/api/judge-guide`](https://ifund-hackathon-demo.interplanetary-fund.workers.dev/api/judge-guide). **Independent clean-browser/mobile and screen-reader acceptance remain outstanding under P0.**
- [ ] AI-generated image and upload enhancement: do not claim as working without visible provider-backed evidence; confirm quota/rights/moderation.
- [ ] Base44 parity/live platform claims: separately verify base44 and interplanetaryfund.com, not inferred from independent demo. Never combine demo sandbox receipts with production records.

## Operational safeguards

- Keep PayPal sandbox and real-money transactions isolated, with no synthetic financial successes.
- No new paid subscriptions, Base44 builder-credit usage, or duplicate PayPal apps/webhooks.
- Match demo deployment SHA to the code actually shown in screenshots/video.
- Do not expose admin credentials, buyer passwords, PayPal secrets, service-role keys or full customer financial identifiers publicly.
- A manually marked checklist item is not proof; attach an observed output, timestamp, and relevant provider record.
- Submit first-priority required evidence before optional visual enhancements if time is constrained.

## Contradictions to resolve

1. `docs/hackathon/PAYPAL_2026_COMPLIANCE.md` tracks the **main Pages app** whose four sandbox orders were all created and whose sandbox event count was zero at the Nov 11 inspection. `demo/VERIFICATION.md` tracks the **independent judge Worker**, which documents one captured record and webhook event. Different datasets, never combine them.
2. `docs/hackathon/DEVPOST_DESCRIPTION_DRAFT.md` is explicitly an unsubmitted draft for the main app; `demo/DEVPOST_SUBMISSION.md` is the current independent demo submission **package**, not proof that Devpost accepted the entry.
3. Static prewritten campaign choices in the main app `DemoJourney` are sample UI, not evidence of AI inference. Actual Workers AI provider calls must be shown in the judge demo.
4. A server log, HTTP 200, and deployed code are not interchangeable with a functioning buyer browser walkthrough.
5. AG Grid/Postman and map/metric/connection claims should only be made in Devpost if demonstrably present in the actual submitted demo.

## Final release signoff fields

- Canonical live demo URL / UTC verified:
- GitHub commit SHA + deployed Worker version:
- Browser and device coverage:
- AI invocation evidence (redacted):
- Provider order/capture evidence (redacted):
- Signed webhook/deduplication evidence:
- Isolated ledger/receipt and production-zero-change SQL evidence:
- AG Grid / Postman / globe / cross-post evidence, **if claimed**:
- Public YouTube URL + video duration:
- Exact reviewed Devpost description and sponsor tools:
- Devpost PayPal AI Hackathon entry URL/receipt + submitted at:
- Remaining unsupported claims corrected or removed:
- Final acceptance reviewer:


## P0–P2 — campaign imagery and sandbox ledger remediation backlog (2026-11-11)

This section consolidates the reported findings from the proposed photo/payment automation and the documented independent-demo gaps. **No new photo replacements, sandbox payments, or ledger test runs are claimed by creating this checklist.** The conversational figures of **83 campaigns, 81 missing photos, and 3 captured orders** were not independently backed by database output in this checklist-writing session. Previous independently documented `demo/VERIFICATION.md` showed **10 fictional campaigns, 3 order intents, 1 captured receipt, and 1 webhook event** at its inspection time. Reconcile scope, data source, timestamps and counts rather than substituting one inventory for another.

### P0 — establish actual inventory and environment

- [ ] **INV-01** Query active demo `ifund_demo_*` campaign tables and media references; record total campaigns, missing/broken/duplicate images, authorizations, campaign status, category, existing image URL and exact timestamp. Investigate discrepancy with reported 83/81 and older 10-campaign snapshot.
- [ ] **INV-02** Record current standalone demo Worker deployment version, Supabase project/schema, R2 bucket and payment environment; compare against main Pages `ifund_paypal_sandbox_*` and production tables; prove hard isolation.
- [ ] **INV-03** Query sandbox Orders v2 intents, provider-confirmed captured orders, verified webhook rows, isolated receipts, journal entries and financial UI totals. Report real counts and currencies by campaign; distinguish test fixture from provider evidence.

### P1 — safe, relevant, free campaign photographs

- [ ] **IMG-01** For every fictional campaign lacking a usable photo, identify relevant search keywords based on title/story/category/location without representing real disaster victims, identities or event-specific claims falsely.
- [ ] **IMG-02** Source images from genuinely free, commercially usable sources or clearly compatible Creative Commons licenses; verify each actual asset's license, author, source URL, allowed transformations, and attribution requirement. Do not treat search thumbnails or unknown-license photos as free.
- [ ] **IMG-03** Record source URL, license snapshot/date, creator credit, usage restrictions, asset dimensions and campaign binding in a machine-readable manifest; reject noncompliant/ambiguous assets.
- [ ] **IMG-04** Download once, optimize to web formats/sizes, deduplicate by content hash, and store in existing R2 or documented storage with predictable public URLs and no new paid services; honor attribution and hotlink rules.
- [ ] **IMG-05** Update only authorized fictional sandbox campaign media references via existing authenticated backend. Never overwrite real organizer photos or change live/Base44 data. Retain previous reference and rollback mechanism.
- [ ] **IMG-06** Verify every updated photo: correct campaign relevance, 200 response, browser display, mobile crop, alt text, licensing attribution, no broken URLs, and no unexpected storage or egress cost.

### P1 — varied real PayPal sandbox capture acceptance

- [ ] **PAY-01** Confirm sandbox buyer and merchant are different, correct PayPal sandbox REST app credentials, order/capture routes, webhook registration and correctly isolated data tables. Protect credentials, never issue real charges.
- [ ] **PAY-02** Select a bounded, representative campaign sample covering all categories; test multiple real PayPal sandbox purchase amounts (suggested USD $1.00, $2.50, $3.33, $5.00, $10.00, $25.00; max within current backend limits). Amounts must be legitimate provider-captured sandbox transactions to enter captured ledger; do not generate fake successful payments.
- [ ] **PAY-03** Record provider order ID, approved buyer flow, capture ID, exact amount/currency, campaign ID and timestamp, verifying each against PayPal Orders v2; redact buyer data and tokens in saved evidence.
- [ ] **PAY-04** Prove each successful provider capture writes one isolated receipt, matched campaign attribution, the intended balanced debit/credit journal and accurate donor/organizer/admin displays. Platform-support sandbox tests must not be attributed to campaigns.
- [ ] **PAY-05** Test exact-cent rounding, duplicate retries, simultaneous capture attempts, duplicate webhook delivery, webhook delay, abandoned/cancelled checkout, unsupported amounts, invalid campaign, refund and reversal paths. Persist failure state without false success; require provider proof for refund/reversal.
- [ ] **PAY-06** Verify authorized campaign owner scope, RLS, role-specific finance visibility and no personal/financial data crossing demo accounts; test anonymous and ordinary-user negative cases.

### P1 — accounting integrity and reusable production lessons

- [ ] **LED-01** Automated read-only reconciliation: provider captured total = sum of unique matched captured receipts = expected gross test ledger movement; each journal group balances to zero in integer minor units. Explain differences from signs/contra accounts rather than blindly summing all journal lines.
- [ ] **LED-02** Detect orphaned order intents, captured orders without receipts, receipts without valid provider captures, webhook rows without known provider events, duplicate capture IDs, duplicate provider event IDs, negative balances and impossible state transitions.
- [ ] **LED-03** Reconcile per-campaign totals, donor history, owner finance and administrative totals with confirmed isolated receipt source; compare cache freshness and refresh behavior, never compare demo totals to real donations.
- [ ] **LED-04** Preserve and test the live-platform 7% withdrawal-fee *rule separately* without inventing payouts or charging a sandbox withdrawal fee at checkout; payouts remain disabled until owner authorization, accounting and idempotency pass.
- [ ] **LED-05** Port **code/tests and schema invariants**, not sandbox payment rows or identities, into live checkout paths only after environment-specific review. Re-run provider-backed live validation under separate authorization, and prevent sandbox credentials/webhooks leaking into production.

### P2 — showcase and recurring automation quality

- [ ] **OPS-01** Confirm the old overlapping Studio Release workflow is paused, the intended photo/payment agent is actually enabled, and its schedule/prompt/tool access are correct. Do not assume an automation was created or active from a chat message.
- [ ] **OPS-02** Rate-limit repetitive test captures and image searches; stop after bounded coverage, avoid paid AI/stock services and Base44 builder credits, and do not rerun settled scenarios without a code or config change.
- [ ] **OPS-03** Each run reports inspected campaigns, successfully replaced images, rejected images/license problems, genuine new provider captures, reconciliation results, any failed test and its repair/deployment evidence. Do not claim work complete because a task/PR exists.
- [ ] **OPS-04** Demo visuals label imagery and campaign/finance figures as fictional. Provider-backed PayPal sandbox transactions are distinct from illustrative donation activity and production donations.
- [ ] **OPS-05** Retain redacted run evidence, tests, rollback notes, deployment SHA and costs; alert on failed reconciliation and stop further captures until the defect is resolved.

### Acceptance gate: sandbox photo/ledger agent

- [ ] All in-scope campaign photo placeholders are replaced or explicitly recorded as blocked by license/consent/relevance; verified manifest and live browser screenshots.
- [ ] One genuine provider-confirmed transaction for each *selected* amount/category case; no unverified capture or promotional mock data counted as payments.
- [ ] Zero unexplained mismatches in provider-to-receipt-to-ledger reconciliation, zero duplicate success records, all negative controls passing.
- [ ] No production, live PayPal, real donor, or Base44 financial data changed.
- [ ] Independent evidence and any production-safe code improvements recorded with deployed version and rollback plan.



## Implemented in current engineering pass — 2026-11-11

1. **INV-01 partially accepted:** Direct Supabase query verified 83 published fictional campaigns and 81 missing image paths at start; older 10-campaign count was a historical snapshot rather than the current inventory. Categories total 83 (education 23, community 19, creative 13, environment 10, animals 7, disaster relief 5, emergency 4, medical 1, science 1).
2. **LED-01/LED-02 implemented as executable audit:** `demo/sql/sandbox-integrity-audit.sql` was committed and executed against canonical demo tables. At 2026-11-11 20:16:30 UTC it returned three captured sandbox orders totaling 2,700 cents, three matching receipts, three event rows, six journal entries, zero anomalous orders, zero orphan captures, receipts, webhooks or ledger groups, and zero malformed journal groups. Provider status is from stored database evidence; a fresh PayPal REST GET remains required.
3. **IMG-01/IMG-02 pilot implemented:** One public-domain photograph from Wikimedia Commons (creator Klest; explicit public-domain release) was researched, checked via exact image URL, and assigned only to the fictional campaign "A little garden for a whole neighborhood" (UUID `10000000-0000-4000-8000-000000000005`) using a conditional update from empty image path. Original public-domain source and license documented in `demo/MEDIA_SOURCE_MANIFEST.md`. Immediately after the update, database count was **80 image paths missing**, three populated. This is a direct Commons URL pilot, not an R2 object migration. Browser/CSP rendering verification is still pending.
4. **No new PayPal payment attempted:** A payment capture is not automatable without an authorized independent sandbox buyer session. No synthetic captures or real charges created. Three outstanding created orders remain uncounted.
5. **Next acceptance work:** verify pilot image in the judge browser and migrate a licensed/attributed optimized asset into the existing R2 media path if needed; complete remaining imagery; test real provider approval/capture and negative cases; connect recurring integrity audit to a controlled read-only run; finish judge browser/Devpost evidence.

Recorded GitHub commits: `189bd345c981` (SQL audit), `70334fac8fbf` (webhook assertions), `3964c784274f` (media license provenance). These are source commits, not proof of worker deployment. Do not mark all IMG or PAY acceptance cases complete until verified.


### Database authorization catalog verification (2026-11-11)

Read-only PostgreSQL catalog query on `ifund_demo_campaigns`, `ifund_demo_media`, `ifund_demo_orders`, `ifund_demo_captures`, `ifund_demo_receipts`, `ifund_demo_events`, and `ifund_demo_ledger` confirmed **RLS enabled** on all seven; neither `anon` nor `authenticated` has direct SELECT or INSERT privilege on any. This passes the table-grant check but is not a substitute for live horizontal-authorization browser tests through the Worker.

Pilot image source URL returned image bytes in a browser-independent image lookup; source page declares uploader-surrendered public-domain rights. The `image_path` was inserted in canonical demo Supabase, re-read and counted: 83 fictional campaigns, **80** blank image paths, one newly linked public-domain image and two existing media paths. Direct deployed-browser rendering, remote-image CSP and longer-term R2 residency remain outstanding.


### Further direct implementation and reconciliation — 2026-11-11

- Added CC0 telescope imagery to fictional `Asteroid Observatory Nights` and CC0 digital classroom imagery to fictional `Aurora Harbor Learning Labs`; exact source URLs, creators, licenses and campaign IDs retained in `demo/MEDIA_SOURCE_MANIFEST.md`.
- Post-write Supabase verification: **83 campaigns, 78 blank image paths**, with **three** new Wikimedia-hosted CC0/public-domain URLs (plus two existing media paths). All three writes were guarded by `fictional=true` and a blank `image_path` predicate; no live photos touched.
- Confirmed `iFund Sandbox Media & Ledger` automation enabled, overlapping `iFund Studio Release` automation paused, and other release/frontend/backend tasks enabled. Requested the active sandbox agent's immediate run; its host reported an inline run in this conversation, not a detached completed external task. Do not claim additional asynchronous photo or payment work from that result.
- Operational limitation: direct image URLs are still a **pilot** pending actual browser CSP/render and long-term storage checks. Do not mark entire photo acceptance gate complete or assume three photos means three different R2 objects.


## 2026-11-11 20:38 UTC — completed direct image coverage / repair and rerun audits

**This record supersedes previous image-missing counts of 81, 78, 33 or 3.** The current canonical independent judge-demo `ifund_demo_campaigns` schema contains 83 published fictional campaigns and **zero null/blank image_path values**. The actual public demo's `GET /api/campaigns` was requested through Supabase `pg_net` and returned HTTP 200 JSON containing all 83 campaigns, each with a nonempty image path.

**Completed implementation:**
- Assigned licensed, theme-relevant photo URL references across all previously blank fictional campaigns, reusing sources for their legitimate campaign-family variants rather than uploading 83 separate images. Applied conditional Supabase updates to `fictional=true` rows with empty image paths; no Base44/real fundraising images changed.
- Added `demo/MEDIA_SOURCE_MANIFEST.md` source, photographer and licensing provenance; current unique image URL count is 20: 18 distinct Commons URLs used by 81 fictional campaigns plus two original `/api/media/<id>` records. Entries are thematic illustrations, not photos of the fictional actual beneficiaries.
- Committed and ran `demo/sql/sandbox-media-audit.sql`: **83/83 paths populated; 81 correctly hashed Commons paths, two internal media paths, zero invalid paths, zero unresolved media records**.
- Ran HTTP byte-range probes for 19 original external images: 17 responded 200/206 `image/jpeg`; one shelter photo got 429 (remote throttling), and one FEMA thumbnail got 400. **Repaired all eight affected campaign references**: the Comet Haven campaign uses an existing HTTP-200 CC0 dog photo, three Starlight Wildlife Rescue campaigns use the verified HTTP-200 CC0 rescued baby squirrel photo, and four disaster-relief campaigns use the verified HTTP-206 public-domain emergency shelter photo. Subsequent SQL media audit passed; source manifest marks the two bad URLs superseded.
- Verified public judge demo /api/campaigns HTTP 200 using an unauthenticated request (not a privileged in-app account); confirms live API exposes image fields, not visual display in browser.
- Executed `demo/sql/sandbox-integrity-audit.sql` after all media updates. **3 stored captured sandbox orders totaling $27.00; 3 receipts, 3 webhook events, 6 ledger journal rows, no anomalies, no orphan/malformed rows or ledger groups.** This verifies persisted financial consistency, not a new provider REST reconciliation or buyer-approved capture. **No new payments were initiated.**

**Still open; do not falsely mark complete:**
- Real browser rendering, mobile cropping, image origin/CSP and full-image download verification. Byte-range GET validates URL reachability/type, not browser-level render; the two original internal media objects have not had fresh browser checks.
- Long-term durability, hotlink dependence and optional optimized R2 copies only when useful and free. Current external photos are remote URL references, not new R2 objects.
- Independent PayPal SANDBOX buyer-authorized new capture, provider-side order inspection, signed webhook replay/negative tests, refund and $2.50/$3.33/$5/$10 amount coverage. The separate 1,400 simulated activity rows do **not** count as payments, receipts, captures, or ledger settlement.
- Actual Devpost submission contents/confirmation and public YouTube evidence, fresh-source build, complete judge login and role navigation acceptance.

**Release discipline:** No deployment/publish claim from a GitHub documentation commit; live demo database updates were independently checked via the public judge API. Never market recorded fictional activity as real donations or allow it into real financial tables. If another agent modifies these rows concurrently, refresh and reconcile before any further writes.

**Final post-repair public API check:** A new unauthenticated HTTPS `GET /api/campaigns` returned HTTP 200 JSON with 83 campaigns, 0 blank image paths, 0 references to either retired problem image URL, and 3 Starlight Wildlife Rescue images pointing to the CC0 squirrel replacement. Confirmed against the deployed Worker endpoint via `pg_net` response request id 99. This proves repaired DB references are being served by the Worker API; not actual browser image render.

## Judge tour release checkpoint — 2026-11-12 14:38 UTC

- Source: merged PR #266, GitHub commit `0141b003a85405ae5f2263d1e2f10c232a4637ba`. Interactive guide uses the **existing sandbox React app**, not a static/mock interface.
- Cloudflare Worker deployment `54c6b9b5-af5a-4418-8c86-e89beacfa660`, version `0d6ddd00-6f45-428c-be84-cbe69c1ea720` at 100% traffic. All existing 13 Worker bindings including static assets, R2 media, and PayPal sandbox credentials retained. No PayPal or ledger logic modified.
- Open judge entry: `https://ifund-hackathon-demo.interplanetary-fund.workers.dev/api/judge-guide`. The route serves an isolated guide shell with a same-origin iframe for `/hackathon`, seven live steps, highlighted controls with non-intercepting outlines, and a **separate instruction rail**. On <=690px screens instructions occupy space beneath the embedded app, not over it; an external full-demo link supports non-frameable PayPal approvals.
- Source checks: 15 static/contract assertions passed, including valid guide JavaScript, responsive layout and preserved API/asset boundary. Cloudflare accepted the Worker and confirms deployment/version assignment. A new external real-browser visual journey was **not** verified: available public fetch routes returned an access restriction from this execution environment. Do not treat contract checks as user interaction or provider success.
- No buyer approval, financial record, synthetic receipt, R2 upload, Base44 mutation, DNS change, or production financial transaction was performed. The separately tracked PayPal checkout/finance and media-license acceptance gates remain open.
