# NEXUS week-46 specialist coordination exercise — 2026-11-15

**Status:** isolated real-source evaluation only; **not** an accepted specialist upgrade, live multi-agent routing, or model retraining.

Source read on `feature/route-completion-20261113`:
- `docs/agents/WEEKLY_SPECIALIST_LESSONS_20261114.md` (Git blob `122fb1813983a8e555adeb64ba3b5a58b5cb76eb`)
- `docs/agents/SHARED_TEAM_CONTEXT_CONTRACT_20261115.md` (Git blob `c0a29926eabb76b95b67142cfaaa73caa8636cfc`)
- `apps/web/src/lib/agentTrainingDirectory.mjs` (Git blob `80a25b1aef9abd853cc23a31da2f73a1babb62ab`)

## Isolated synthetic execution (8/8 PASS)

The coordinator fetched the exact versioned directory source and evaluated its pure `recommendAgent` and `proposedSpecialistHandoff` exports in an isolated JavaScript function context, checking these assertions:

1. Fictional request for a budget, story, outreach, and donation attribution is assigned to **NEXUS**.
2. Multi-topic workflow identifies **ORBIT**, **STORY**, **PULSE**, and **FORGE**.
3. Returned handoff is `state:proposed`, `transmitted:false`, and `verifiedExecution:false`—no false successful handoff.
4. Scope is `authenticated_owner_team`; cross-owner access remains denied.
5. A budget-only referral from STORY identifies ORBIT.
6. A mixed LINK/DISCOVER peer referral from PULSE is coordinated by NEXUS, not limited to STORY/ORBIT.
7. NEXUS has all eight other roles in its reviewable consultation directory.
8. External sharing requires a separate authorization, and shared team context is explicitly marked unavailable at runtime.

Observed result: **8 passed, 0 failed** on the exact source blob. These tests assert routing proposals and declared policy. They do **not** authenticate two users, read/write the live shared context, verify providers, complete an external action, or exercise actual specialist services.

## Budget-to-story safety handoff

Fictional pantry line items: shelves $1,200; refrigeration $2,900; safety supplies $700; sum **$4,800**. The figures are user-supplied hypothetical amounts, **not independently verified expenses**. ORBIT may format a source-labeled spending brief and request owner approval for the consequential narrative use; STORY may then draft empathetic language without fabricating a beneficiary quote or suggesting a verified outcome. Existing same-owner *internal* context retrieval must not require new per-agent permission. Financial verification, publication, provider payments, outreach and third-party disclosures remain separately authorized. Both the proposed ORBIT result and owner approval are **pending**, not performed.

## Provisional exercise evaluation

- Factual fidelity: 4/4 (fictional inputs and provenance explicitly labeled)
- Donor autonomy: 4/4 (no sending, checkout, or manipulative CTA)
- Spending/source transparency: 4/4 (budget arithmetic and provider verification distinct)
- Context preservation: 2/4 (directory proposes same-owner context, but runtime retrieval not established)
- Routing: 4/4 (8 of 8 pure-source proposal checks passed)
- **Provisional score: 18/20 on a synthetic exercise only.** Independent reviewer approval and the weekly lesson's two current primary research/provider sources with provenance revalidation remain outstanding; **do not record as accepted lesson or a verified capability**.

## Release / implementation dependencies

Agent 2 owns owner-RLS, immutable team-event SQL and existing agent endpoint transport; Agent 1 owns private history and account-switch UX; Agent 3 owns external provider/financial permission boundaries; Agent 4 owns executable two-owner database and cross-agent read-after-write/erase/replay QA. `IFUND_TEAM_CONTEXT_ENABLED` remains **off** until owner-authorized release and verified migration and service integration.

No private user messages were read or stored; no secrets, financial operations, production SQL, deployment, or Base44 changes.
