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
- [ ] Guided demo: numbered, short directive per step, highlighted exact controls, back/next and completion states; no fake successful actions.
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

