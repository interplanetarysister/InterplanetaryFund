# Interplanetary Fund — IF Features #0.5–#23 Reconciliation Baseline

Date: 2026-08-21
Status: Baseline audit — evidence pass continued; no feature implementation changes made by this document.

## Purpose

This document is the evidence-based reconciliation pass required by IF Feature #0.5. It compares the recovered archived feature intent against the current `interplanetary-fund2` repository and its authoritative `InterplanetaryFund` Convex backend before implementation work is assigned.

A UI/file/entity proves an implementation surface, not end-to-end completion.

## Repository ownership

- `interplanetary-fund2` — user-facing Base44 application.
- `InterplanetaryFund` — authoritative Convex backend / agent runtime.
- `interplanetary-fund-backend` — legacy/reference repository; no new production backend work unless explicitly directed.

`AGENTS.md` establishes Convex as the source of truth for persistent agent identity, memory, outcomes, campaigns, protocol, treasury, payments, and scheduled intelligence.

## Status vocabulary

- 🟢 Implemented surface — evidence exists; end-to-end correctness still requires verification.
- 🟡 Partial — meaningful pieces exist but definition of done is not established.
- 🔵 Refinement required — implementation exists but archived requirements demand stronger behavior/UX/integration.
- 🟠 Broken/incorrect — evidence indicates a known defect or unsafe/inaccurate behavior.
- 🔴 Missing — no meaningful implementation evidence found.
- ⚪ Deferred — intentionally set aside; do not build unless reactivated.
- ⚫ Superseded — older direction replaced by later approved architecture.

## Feature evidence matrix

| Feature | Archived intent | Evidence | Status | Remaining audit focus |
|---|---|---|---|---|
| #0.5 | Reconciliation/implementation control process | `AGENTS.md`, reconciliation docs, GitHub issues | 🟢 | Finish evidence matrix; then convert only verified gaps to issues |
| #1 | Social Integration Engine / real multi-platform publishing | Connections, catalog, PlatformConnection, publish/broadcast functions, real Bluesky/Mastodon publisher | 🟡 Partial | OAuth/provider permissions, token handling, approved providers, scheduling/retry/idempotency, E2E |
| #2 | External crowdfunding integrations | Platform catalog/connection framework, campaign migration UI | 🟡 Partial | Verify each provider's actual API/partner restrictions; keep manual/owner-reported paths honest |
| #3 | AI Outreach / donor, sponsor, partner opportunity discovery | Opportunity entity/UI, Outreach Agent, Convex agent automation | 🟡 Partial | Research quality, matching, consent, privacy, execution, audit |
| #4 | Universal Identity Graph | Canonical agent identity registry + runtime bridge; broader relationship graph not yet proven | 🟡 Partial | Authoritative person/account/relationship/authorization graph, delegation, deduplication, audit |
| #5 | Unified Communication Hub | Base44 communication surfaces + Convex agent/runtime infrastructure | 🟡 Partial | Inbound/outbound truth, permissions, delivery, AI actions, audit, automation |
| #6 | Campaign Operating System | Campaign entity/protocol, campaign pages, AI, funding, updates, analytics/outreach | 🟡 Partial | Map archived requirements to actual runtime behavior and contracts |
| #7 | Community OS + Institution OS | Community/CommunityMember, Institutions, discussions/posts/volunteer | 🟡 Partial | Roles, moderation, institution permissions, partnerships, shared identity, analytics/mobile |
| #8 | AI Campaign Story & Donor Optimization | AIStoryGenerator, campaignAI, AICoach, AI campaign generation backend | 🟡 Partial / 🔵 | Fact locking, voice, audience adaptation, approval/versioning, learning, truth protection |
| #9 | Trust/Verification/Transparency + research-backed budgeting + capable specialists | Agent system, Finance/Trust infrastructure, health/intelligence surfaces | 🟡 Partial / 🔵 | Research/source integrity, numerical correctness, trust evidence, specialist tools/execution |
| #10 | Platform Foundation + 10-OS architecture | Platform blueprint/constitution/standards, service health, Convex agent runtime | 🟡 Partial | Event bus/contracts, auth, jobs, idempotency, observability, environment separation |
| #11 | Mission Control — intelligence layer | Intelligence generation, mission/opportunity surfaces, OpsCenter, agent automation | 🟡 Partial / 🔵 | Prove observe→understand→prioritize→recommend→execute→verify→learn |
| #12 | Campaign Coach | AICoach/campaignAI + agent infrastructure | 🟡 Partial / 🔵 | Campaign context/memory, delegation, research, execution, undo/audit, mobile UX |
| #13 | Creative Agent / visual asset system | Cover/image generation and campaign asset surfaces; video remains deferred | 🟡 Partial | Asset lifecycle, fact locking, versioning, preflight/accessibility; preserve video deferral |
| #14 | Automated Campaign Opportunity Detection & Intelligence | OpportunitiesPanel, Opportunity entity, outreach/intelligence automation | 🟡 Partial | Freshness, qualification/scoring, alerts, execution, learning, privacy |
| #15 | First-Success Guided Onboarding | Onboarding steps and saved onboarding state | 🟡 Partial / 🔵 | Adaptive path, first-success checklist, persistence, defaults, child-simple UX |
| #16 | User Profile / Preferences / Personal Context | User schema now contains onboarding, communication preferences, subscription fields | 🟡 Partial | Verify all frontend/backend writes and reads, identity/permissions, complete schema contract |
| #17 | Automated Communication & Notification Intelligence | Notification/communication infrastructure + agent automation | 🟡 Partial / 🔵 | Event routing, grouping, briefings, authorized sending, delivery truth, preference enforcement |
| #18 | Distribution / Multi-Platform Publishing | Distribution UI, content generation, publish/broadcast, connection framework | 🟡 Partial | Provider execution, scheduling, retry, duplicate prevention, attribution, approval modes |
| #19 | Analytics / Intelligence / Campaign Performance | Analytics/CampaignPerformance/Reports/AlertCenter + Convex intelligence | 🟡 Partial / 🔵 | Data lineage, calculations, forecasts, attribution, source transparency |
| #20 | Premium / Subscription AI Capabilities | Subscription plans/status fields and subscription infrastructure | 🟡 Partial | Entitlements, billing truth, capacity, spending limits, safe shutdown, no surprise charges |
| #21 | Help / Guidance / User Assistance | Help exists in platform lineage | 🟡 Partial | Current-state-aware help, diagnostics, safe fixes, escalation, no fake functionality |
| #22 | Trust, Verification & Safety Intelligence | Security, financial audit, automation consent, trust/health infrastructure | 🟡 Partial | Verification lifecycle, appeals, suspicious activity, privacy/security, human review |
| #23 | Community & Supporter Network | Community pages/entities/membership/discussions/posts/volunteer/follow relationships | 🟡 Partial | Supporter lifecycle, campaign communities, events, moderation, discovery, privacy, analytics |

## Continued backend evidence

### Agent identity and memory
The authoritative Convex backend has `agentIdentity.ts` with stable canonical identities for Solene, Atlas, Post Production, Donor Relations, Scout, Platform Coordinator, and Finance, while preserving Base44 aliases. `agentBridge.ts` records Base44 interaction summaries into authoritative Convex agent working/long-term memory and outcome counters. This confirms the intended Base44→Convex runtime bridge is implemented. It does **not** prove the complete Identity Graph for people/accounts/relationships required by Feature #4. fileciteturn66file0 fileciteturn62file0

### Agent automation
`agentAutomation.ts` contains per-agent enable/disable controls, automation status, and scheduled agent work across both `monitoredCampaigns` and `userCampaigns`. This is meaningful execution infrastructure, not just UI. However, individual feature acceptance still requires verification of authorization, provider execution, idempotency, and task outcomes. fileciteturn63file0

### Automation consent
`automationConsent.ts` implements an explicit agreement/version, campaign-scoped authorization, connected providers, permissions, revocation state, and stated prohibitions on bypassing authentication, changing ownership, redirecting funds, or making unauthorized withdrawals. This materially supports Features #9, #17, #18 and #22, while still requiring verification of every execution path against those rules. fileciteturn64file0

### Financial auditability
`financialAudit.ts` provides an immutable-style financial action logging path recording user/campaign, provider, authorization, transaction amount, before/after state, result, errors, and timestamps. It supports campaign/user/admin audit queries. This is strong infrastructure for Features #9/#22, but the existing issue history still requires the authorization and ledger-integrity findings to be reconciled rather than assumed solved. fileciteturn65file0

### Security controls
The Convex backend has explicit authentication, admin/super-admin/permission checks, and rate limiting helpers in `security.ts`. These provide security infrastructure, but individual mutations still need path-by-path authorization review. fileciteturn68file0

### Social publishing truth
The Base44 catalog is deliberately honest about provider limitations. Most social platforms are marked as OAuth posting pending approval; Bluesky and Mastodon have direct credential-based publishing paths. The publisher returns a manual path for unsupported providers instead of pretending an API exists. This is a positive architectural choice, but means Feature #1/#18 are definitively **partial**, not complete. fileciteturn56file0 fileciteturn57file0 fileciteturn58file0

### Connection security
`PlatformConnection` stores per-platform credentials under owner/admin RLS, has automation modes, sync/error state, history, and external totals. This supports the connection architecture, but real provider-specific OAuth/API completion remains outstanding for many destinations. fileciteturn59file0

### User schema
The current Base44 `User` schema includes `onboarding_completed`, structured `onboarding`, `comm_prefs`, and subscription fields. This resolves the earlier observation that those fields were absent from the schema. Feature #16 remains partial because the complete read/write contract still needs verification across all consumers and authoritative backend identity. fileciteturn52file0

### Authoritative backend historical baseline
The 2026-08-07 Convex `AUDIT_REPORT.md` states that the reference architecture had been integrated, that 21 reference pages and 18 components were covered, and that the IF backend had 40+ Convex tables at that point. It also records a successful build/deployment at that historical point. This is useful historical evidence, not proof of current feature completion. fileciteturn55file0

## Existing issue dependencies that must not be lost

The baseline already identified existing issues #1, #10, #11, #13, #14, #16, #17 and #19 as work that must be reconciled into the feature plan instead of duplicated blindly. In particular, the financial authorization/ledger findings and Message audit-record authorization finding remain dependency-sensitive and must be mapped into the relevant feature issues before implementation. 

## Important issue-number correction

Current repository PR/Issue #5 is a closed Dependabot dependency PR. It is not the IF Feature archive handoff issue and must not be repurposed. The dedicated reconciliation issue is **#23**.

## Architectural guardrails

1. Do not rebuild working systems merely because archived rough drafts describe them.
2. Do not call a feature complete because a page, button, entity, or placeholder exists.
3. Do not call an integration functional until the real provider/API workflow is verified.
4. Keep Convex authoritative for persistent backend/agent state.
5. Do not create competing agent-memory or production backend systems.
6. Keep video generation deferred unless explicitly reactivated.
7. Keep child-simple UX and progressive disclosure.
8. Research-backed numerical claims must identify assumptions and sources.
9. Agents execute authorized actions where specified, never bypassing approval/permission boundaries.
10. Preserve auditability, least privilege, privacy, security, and rollback.

## Dependency-based implementation sequence after reconciliation

1. #0.5 — complete reconciliation/evidence matrix
2. #10 — shared Platform Foundation / OS contracts
3. #4 — Identity Graph / permissions / relationships
4. #16 — profile/preferences/onboarding context/schema integrity
5. #1 + #2 — external integration engines
6. #5 + #17 — communication/notification execution
7. #6 — Campaign OS
8. #11 + #12 — Mission Control/Campaign Coach execution
9. #3 + #14 — opportunity discovery/intelligence
10. #8 + #13 — campaign optimization/creative execution
11. #9 + #22 — trust/verification/research-backed budgeting/safety
12. #18 — distribution execution
13. #19 — analytics/forecasting/attribution
14. #15 — onboarding refinements/first-success
15. #7 + #23 — community/institution/supporter ecosystem
16. #20 — premium automation/capacity hardening
17. #21 — contextual Help/troubleshooting

This order remains provisional until the remaining backend/legacy evidence and issue/PR relationships are audited.

## Next audit pass

Continue inspecting the authoritative Convex repository and legacy/reference repository for every feature, with priority on:

- frontend ↔ Convex ↔ Base44 schema contracts;
- authorization and ownership on sensitive mutations;
- financial integrity and webhook idempotency;
- real provider/API execution;
- agent tools, approvals and autonomous actions;
- event propagation, crons, retries and idempotency;
- tests/CI/build/deployment;
- production environment separation;
- mobile/accessibility;
- existing GitHub issues/PRs;
- deferred/superseded work.

Only after this pass should individual implementation issues be finalized.