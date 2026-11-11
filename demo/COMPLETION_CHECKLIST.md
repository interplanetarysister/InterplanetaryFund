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
