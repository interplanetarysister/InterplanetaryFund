# IFund agent and prepublication assessment — complete implementation register

**Release state (November 13, 2026):** LATEST OWNER INSTRUCTION: code and verification work accumulate with **no new preview/production builds** until an explicit BUILD instruction. Eight earlier agent/prepublication migrations and one bounded NEXUS cron schedule were applied in canonical Supabase before this source-only continuation. SQL deployment and frontend compilation of the new amendments below remain pending. A migration or preview result does not prove a live member journey.

Statuses: **existing** = source capability precedes this change but live journey may be unverified; **staged** = source/SQL/tests committed, not compiled or deployed; **partial** = meaningful implementation exists but key acceptance/behavior remains; **pending** = not implemented.

| # | Agent | Assessed improvement | Status | Evidence / remaining work |
|---:|---|---|---|---|
| 1 | NEXUS | Verified cross-agent handoffs | PARTIAL | Owner editorial handoffs and acknowledgments are staged; independent agent execution remains unavailable. |
| 2 | NEXUS | Scheduled mission briefs | STAGED | Opt-in daily/weekly owner preference, service-only idempotent dispatcher and NEXUS controls staged. Cron activation separately approved; no scheduled delivery yet. |
| 3 | NEXUS | Outcome-based priority ranking | PARTIAL | Existing campaign triage uses owner metrics but not measured task outcomes. |
| 4 | ECHO | Approved recipient messaging | STAGED | Owner-approved in-app messaging to separately opted-in campaign followers with idempotency, 24-hour throttle, at most 50 recipients, and actual DB notification receipts. No email or social sends. |
| 5 | ECHO | Reusable campaign templates | STAGED | Owner-private save/load/delete UI and guarded SQL staged. |
| 6 | ECHO | Delivery and reply tracking | PARTIAL | Support replies exist; provider-delivery events for campaign outreach are not implemented. |
| 7 | PULSE | Eligibility screening | STAGED | Owner provider-verification checklist staged; qualification remains provider-determined. |
| 8 | PULSE | Deadline-change alerts | STAGED | Owner opt-in source-change watch RPC, notification trigger and Institutions controls staged; external provider polling not claimed. |
| 9 | PULSE | Permission-based application preparation | STAGED | Local owner-reviewed application worksheet and copy control staged; never auto-submits. |
| 10 | ORBIT | Reconciliation exception view | STAGED | Read-only cents and attribution anomaly checks added to admin finance. |
| 11 | ORBIT | Payout-readiness explanations | EXISTING | Owner finance/withdrawal UI gates already exist; provider journey needs acceptance. |
| 12 | ORBIT | Refund-aware financial trends | STAGED | Owner-scoped monthly captures and recorded provider-referenced refunds RPC/UI staged; not a cleared balance. |
| 13 | POLARIS | Campaign budget planning | STAGED | Local integer-cent expense planner includes estimated 7% withdrawal fee. |
| 14 | POLARIS | Context-specific rewriting guidance | PARTIAL | Story regeneration exists; Strategy-specific contextual guidance is not complete. |
| 15 | POLARIS | One-click preparation fixes | PARTIAL | Story editor deep link and local punctuation/duplication acceptance exist; field-level auto-navigation remains. |
| 16 | FORGE | Previous-period trend comparisons | STAGED | Seven-day daily activity compared with preceding 23 days using verified counts. |
| 17 | FORGE | Anomaly alerts | STAGED | Read-only in-page declining/growing insights; scheduled notifications remain separate. |
| 18 | FORGE | Outreach experiment tracking | STAGED | Owner-scoped hypothesis/outcome journal and guarded RPC/UI staged, without outbound posts. |
| 19 | LINK | Connection-health checks | EXISTING | Connection verification/refresh supported; provider live session acceptance outstanding. |
| 20 | LINK | Permission-specific publishing readiness | STAGED | Fail-closed scope/grant validator never assumes OAuth connection permits posting. |
| 21 | LINK | Reauthorization guidance | EXISTING | Refresh/reconnect/disconnect UI exists; provider-specific scope error handling requires live test. |
| 22 | STORY | Source-backed claim checks | STAGED | Heuristic claim-evidence warnings staged, never assert a source proves the claim. |
| 23 | STORY | Section-level regeneration | EXISTING | Section regeneration exists behind authorized Story service; provider-backed acceptance pending. |
| 24 | STORY | Reusable campaign voice preferences | STAGED | Owner-private writing style profile, save/load and explicit Apply into STORY brief staged. |
| 25 | DISCOVER | Supported-method discovery | EXISTING | Provider catalog survives via LINK; separate tile consolidated. |
| 26 | DISCOVER | Provider privacy comparisons | PARTIAL | LINK provides provider-specific permission caveats; live privacy-policy metadata is not independently verified. |
| 27 | DISCOVER | Provider alternatives | STAGED | LINK shows safe manual fallback paths for each registered provider. |
| 28 | DISCOVER | Consolidate into LINK | STAGED | Member tile hidden; service identity, code and audit records preserved. |
| 29 | ADMIN | Approval-gated preview releases | EXISTING | Manual one-build preview-first workflow configured, production requires explicit owner approval. |
| 30 | ADMIN | Automated regression evidence | STAGED | Single manual release workflow now archives test logs and immutable compiled-artifact checksum without extra builds. It has not run since this change. |
| 31 | ADMIN | Rollback controls | STAGED | Manual, confirmation-gated Cloudflare Pages successful-production rollback workflow staged; not run. |
| 32 | PREPUBLICATION | Minimum 3,500 story characters | STAGED | Client/Worker checks and DB transition trigger staged; grandfathered active campaigns untouched. |
| 33 | PREPUBLICATION | Punctuation improvements | STAGED | Reversible full-story punctuation/spacing proposals require owner approval. |
| 34 | PREPUBLICATION | Campaign-wide redundancy review | STAGED | Cross-field redundancy prompts and reversible exact duplicate-sentence proposal staged. |
| 35 | PREPUBLICATION | Cross-agent discussion | PARTIAL | Private task queue with role-based review prompts; independent AI peer processing remains unverified. |

**Items: 35; existing 6; source-staged 22; partial 7; pending 0.**
**Implementation gaps requiring further work: 7 in the historical assessment.** The rows above preserve the original assessment status; use the activation evidence below for the updated backend state. Provider-backed acceptance and user-session tests are still required for externally connected features.

**Do not activate independently:** no financial transfer, outbound posting, grant submission, OAuth scope claim, email deliverability claim or autonomous agent execution without provider proof and owner consent.

**Existing active campaigns:** production audit found 26 active campaigns whose story length is below the new 3,500-character threshold. The staged database trigger restricts new publication/resumption only; preserve existing active records and guide owners to expand their stories.

**Canonical frontend:** `apps/web`. **Migrations from the original staging register (now applied; see below):** `20261113_ifund_prepublication_quality_and_agent_review.sql`, `20261113_ifund_echo_private_templates.sql`, `20261113_ifund_pulse_opportunity_watches.sql`, `20261113_ifund_growth_experiment_tracker.sql`, `20261113_ifund_owner_refund_trends.sql`, `20261113_ifund_story_voice_preferences.sql`, `20261113_ifund_nexus_scheduled_briefs.sql`, `20261113_ifund_echo_opted_in_updates.sql`. NEXUS cron is now scheduled daily with a maximum 100 opted-in users per run; no subscribed users or delivered notifications have yet been verified. See activation evidence below.

## Applied activation and safety evidence — November 12 Pacific

**Canonical Supabase:** `ssibsfmtodgximseeqsv`, no changes to campaign payments, provider credentials or withdrawal execution.

- ECHO: `ifund_echo_private_templates_20261113` (private owner templates), `ifund_echo_opted_in_updates_20261113` (approved in-app notifications only).
- STORY: `ifund_story_voice_preferences_20261113` (private owner preferences).
- FORGE: `ifund_growth_experiment_tracker_20261113` (owner experiment record; owner-count creation race repaired by a transaction-scoped lock).
- PULSE: `ifund_pulse_opportunity_watches_20261113` (watch source-data changes; notification deduplication corrected per recipient, not only per opportunity).
- ORBIT: `ifund_owner_refund_trends_20261113` (read-only provider-recorded monthly trends).
- NEXUS: `ifund_nexus_scheduled_briefs_20261113` and `ifund_nexus_opted_in_daily_cron_20261113`. Verified `cron.job` `ifund-nexus-daily-briefs` active, at 15:00 UTC each day with at most 100 due, opted-in owner notifications.
- PREPUBLICATION: `ifund_prepublication_quality_and_agent_review_20261113` applied. A new publish/resume transition enforces a 3,500-character story while preserving all 26 previously active short-story campaigns without modifying them.
- Verified 16 audited private RPC grants: `anon` denied, `authenticated` granted, and privileged NEXUS dispatch restricted to `service_role`. All seven new private tables started empty; this is not simulated user completion.
- Browser owner acceptance, independent agent AI peer processing, external OAuth write scopes, provider message delivery and source polling remain **unverified**. Do not present these as completed features.

**Frontend improvements in this release batch:** prepublication findings link to their actual title/summary/story fields; NEXUS uses verified 7/30-day captures when available and never turns missing data into zero. Source tests added. Only one consolidated production build should be triggered after completing checks, with Cloudflare Git auto-deploy disabled immediately afterward.

## Source-only continuation — November 13 (not built or published)

The original 35 improvement items remain in the register above. Additional changes have been staged, without triggering this turn's build:

- **Publication:** existing live database trigger enforces 3,500 characters on *new* active publication and resumption. A new additive SQL migration aligns trimming of leading/trailing whitespace; it has **not** been applied. Existing grandfathered active campaigns remain untouched.
- **Campaign-wide editorial:** reusable punctuation and repeated-sentence proposals now cover title, description and story, detect full-summary duplication, shared complete sentences and headline duplication. Every proposed edit requires owner review and acceptance; review never invents facts. Both Create and Edit support the multi-field proposals.
- **Team handoff:** the owner-initiated review button checks that the local text matches the saved campaign; it queues **all** applicable findings in sequential batches of at most 12 to avoid silent truncation. New issue categories and a private owner-comment RPC are in `20261113_ifund_editorial_campaignwide_discussions.sql`, **staged only**. Owner replies are not autonomous AI responses.
- **NEXUS:** missing/acknowledged editorial tasks now affect priority ranking; acknowledged means owner reviewed the suggestion, never that an agent executed a rewrite.
- **POLARIS:** specific editorial checks derived from the owner campaign direct to the exact editor field; the campaign editor handles deep-link focus. No claim of context-aware AI generation.
- **ECHO:** staged `20261113_ifund_echo_inapp_read_receipts.sql` counts stored and marked-read notifications without exposing recipient identities. This is not email/provider delivery or replies.
- **LINK:** member interface places connection summaries and selectable platform marks above a single provider context, with more understandable status/permission language. Another independently authored `feature/connections-icon-hub-20261112` branch exists; reconcile its more extensive provider catalog and campaign-share features before merging to avoid duplicate UI/logic.
- **Tests added:** `campaign-wide-editorial-review.test.js`, `agent-editorial-handoff-and-receipts.test.js`, `connection-selection-audit.test.js`, and `ifund-prepublication-whitespace-and-discussion.test.js`. These are **committed but not executed** in this source-only turn.
- **Do not claim complete:** independent agent-to-agent AI discussion, provider messaging replies, verified external policy data, automated provider opportunity polling, verified full authenticated journeys, and acceptance across all screens remain incomplete. Preserve the source release hold and provider financial gates.

### Source release gates remaining
1. Review new SQL against live Supabase schemas and apply only through a separately authorized, reviewed migration.
2. Reconcile overlapping LINK icon-hub branches and shared components before the single consolidated build.
3. Run full frontend/backend/security tests and repair failures; no build was run in this continuation.
4. On explicit BUILD instruction, perform one preview-first build of the cumulative canonical commit; promote the **same** artifact only after separate production authorization.
5. Verify real login, campaign publication, owner discussions, agent roles, provider consent and financial/provider operations without inventing success or test payments.
