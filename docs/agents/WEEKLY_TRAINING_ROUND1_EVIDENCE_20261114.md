# iFund weekly lesson round 1 — executed synthetic exercises and evidence

Execution: 2026-11-14. The five existing enabled ChatGPT development automations accepted immediate `run_now` requests, but each returned `inline_run`: assignments were handled within the initiating conversation, **not** as independent remote agents or a background queue. This document records nine **separately scoped, synthetic, assistant-produced lesson exercises**. They are source-learning evidence only, not independently reviewed mastery, real user-facing service activity, verified runtime handoff, or underlying model retraining.

Reference baseline: [curriculum](WEEKLY_SPECIALIST_LESSONS_20261114.md); [shared routing directory](../../apps/web/src/lib/agentTrainingDirectory.mjs). Every entry below has its own exercise result and limitations.

## STORY — narrative interpretation / 2026-W46
Synthetic fact card: volunteer-operated neighborhood pantry seeks $4,800 for shelving $1,200, refrigeration $2,900, safety supplies $700; no testimonials or beneficiary images approved.
Sample narrative core: "A neighborhood pantry can only share food safely when its supplies are stored and handled with care. The team is seeking $4,800 for shelving, refrigeration, and safety supplies. The plan allocates $1,200 to shelves, $2,900 to refrigeration, and $700 to safety supplies. This request is about practical equipment, not a promise of outcomes. If the cause fits your priorities, you can support or share it; the organizers can explain progress and changes to the budget."
Interpretation: tangible needs enable readers to imagine useful action without inventing suffering; noncoercive ask preserves choice; budget clarity can support trust. Those are **hypotheses**, not verified conversion improvements. This is a short excerpt, **not** the full 350–450 word assignment or the 3,500-character prepublication story. Result: factual core accepted for curriculum; long-form output **NOT TESTED**. ORBIT should review spending facts in the user's shared team context before STORY proposes narrative changes; publishing remains a separate owner-authorized action.

## ORBIT — budget truth / 2026-W46
Exercise: independently reconcile 1200+2900+700=4800 USD. Missing: payment processor fees, merchant routing, availability of receipts, and whether the donor goes to an external fundraising host. Draft finance handoff to STORY: "Shelving $1,200; refrigeration $2,900; safety supplies $700; $4,800 planned total. User-provided **unverified estimates**, not invoices. No verified provider fees or tax claims. Do not imply all costs are paid or outside-host funds were collected by iFund." Result: arithmetic and separation checked by author; provider and receipt status unknown. No fund transfer authorized.

## POLARIS — scope and evidence / 2026-W46
Exercise: identify readiness rubric dimensions: stated purpose, itemized need, specificity, beneficiary dignity, credible updates, accessibility, optional sharing plan. Hypothesis: some readers might prefer concrete budget and clear updates; do not infer individual motivations or calculate a donation likelihood. Result: nonpredictive rubric defined; no experimental result.

## FORGE — donation measurement / 2026-W46
Exercise: mock data (fictional): 100 tracked clicks, 20 partner-confirmed gifts, $500 provider-verified total, 30 self-reported gifts. Count provider-confirmed gifts only as 20; do NOT sum 20+30 as 50 because overlap is unknown. Click-to-confirmed-gift rate is 20/100=20% **only if** attribution and denominators refer to the same cohort, same time window and verified identity/click methodology; otherwise report each metric separately. Result: provenance rule passed on synthetic case; real partner attribution NOT VERIFIED.

## ECHO — trust-preserving communications / 2026-W46
Exercise: optional supporter update: "The pantry is working toward equipment for safer storage. The current plan is $1,200 for shelving, $2,900 for refrigeration and $700 for safety supplies. These are planned costs; we'll share confirmed purchases and any budget changes when documented. Thank you for considering sharing or supporting." No faux delivery claims, implied opt-in or unsupported urgency. Result: source-only draft; sending not authorized.

## PULSE — audience and permission / 2026-W46
Exercise: propose community organizations with publicly documented missions aligned to food access, and ask their contact owners for permission to share. No bulk-message scraping, no demographic profiling, no unsolicited automated contacts. Result: consent gates defined; no external discovery or outreach executed.

## LINK — authorization taxonomy / 2026-W46
Exercise: public external URL alone means `public_link_only`; a user-supplied URL does not prove platform account ownership, OAuth access, read API/webhook permission, or safe transfer. Reject lookalike checkout host and require verified provider documentation before deeper integration. Result: reviewed concept; no provider connection made.

## DISCOVER — research / 2026-W46
Exercise: differentiate public documented provider developer guides from a signed commercial partner agreement. Record provider, URL, documentation date, OAuth scopes, published API limitations, and unknowns before advising LINK. Result: capability matrix fields established; no provider rights represented as granted.

## NEXUS — multi-specialist routing / 2026-W46
Exercise input: "Please put my spending plan into my campaign story, share it on social networks, and tell me which donations came from those posts."
Expected workflow: ORBIT drafts and validates the owner's cost plan -> all same-owner team agents may access relevant stored conversation context -> STORY writes truthful and appealing narrative -> ECHO/PULSE prepare opted-in platform-specific messages -> LINK verifies connector scopes and owner-specific permission -> FORGE reports tracked clicks separately from provider-confirmed gifts -> NEXUS verifies stage receipts and states incomplete steps honestly. Result: routing design captured; **no real inter-agent conversation, financial operation, connection or social post occurred**.

## Overall evaluation / status
- Nine distinct topic exercises prepared; eight concise artifacts plus STORY's short core sample, and a cross-specialist workflow.
- Source-review criteria: consistent amount arithmetic, no invented beneficiary claims, no psychological manipulation, no unconsented external action and no fabricated analytics. Independent 18/20 reviewer scoring **not completed**; do not mark individual specialties trained/live solely from these exercises.
- Runtime changes: `worker/agents/story.js` source prompt updated to include dignity, evidence caveats, financial consultation, partner-aware boundaries. `AgentsTeam.jsx` source now offers an informational specialist recommendation and displays each skill; it does NOT dispatch a server agent task.
- Next verification: run Node tests, type/build checks and authenticated preview smoke under release gate, independent specialist evaluation and real RLS-safe handoff. No production, preview, payment or provider changes were triggered by this round.


## 2026-11-15 correction: team-wide user context
The previous round used STORY/ORBIT as an *example* rather than a special-cased flow. All nine agents are intended to share relevant conversation context from any authorized interaction of the same user account, without repeated internal handoff permission. Source policy and test expectations are now recorded in [shared team context contract](SHARED_TEAM_CONTEXT_CONTRACT_20261115.md). The server-side all-conversation ingest/read-after-write system remains unverified, and no external sharing or financial action is authorized by this correction.
