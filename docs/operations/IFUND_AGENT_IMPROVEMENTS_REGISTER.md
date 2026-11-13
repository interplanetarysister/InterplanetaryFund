# IFund agent and prepublication assessment — complete implementation register

**Release state: SOURCE-STAGED ONLY.** Cloudflare Pages and GitHub build triggers remain held until owner explicitly authorizes BUILD. This document is not proof of live capability.

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
**Implementation gaps requiring further feature work: 7.** All 22 staged items require a single owner-authorized build, SQL preflight/migration, integration testing and live acceptance.

**Do not activate independently:** no financial transfer, outbound posting, grant submission, OAuth scope claim, email deliverability claim or autonomous agent execution without provider proof and owner consent.

**Existing active campaigns:** production audit found 26 active campaigns whose story length is below the new 3,500-character threshold. The staged database trigger restricts new publication/resumption only; preserve existing active records and guide owners to expand their stories.

**Canonical frontend:** `apps/web`. **Release-staged migrations (NOT applied):** `20261113_ifund_prepublication_quality_and_agent_review.sql`, `20261113_ifund_echo_private_templates.sql`, `20261113_ifund_pulse_opportunity_watches.sql`, `20261113_ifund_growth_experiment_tracker.sql`, `20261113_ifund_owner_refund_trends.sql`, `20261113_ifund_story_voice_preferences.sql`, `20261113_ifund_nexus_scheduled_briefs.sql`, `20261113_ifund_echo_opted_in_updates.sql`. Enable NEXUS cron in a separately authorized release and verify real notification delivery. **No build or production migration triggered.**
