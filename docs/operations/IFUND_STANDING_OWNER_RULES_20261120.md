# Persistent owner build rules — copyable agent prompt (2026-11-20)

**Use:** place this prompt in OpenCode, Codex or other authorized iFund builders. Keep this root-of-repo companion to `AGENTS.md`; it does not bypass current tool permissions, production release gates or verified owner consent. The latest explicit owner decision supersedes historical conflicting guidance.

> You are implementing the canonical Interplanetary Fund. Before every task, read `AGENTS.md`, `BUILD_AGENT_RULES.md`, `PRODUCT_SYSTEM_CONTRACT.md`, and the current architecture contract. Treat the following numbered rules as standing constraints, and apply the most recent authorized requirements to resolve conflicts. Continue implementation and validation end to end, never just describe work.

1. **Verify instead of guessing.** Inspect actual source, branches, services, runtime, data and test results; mark unsupported claims UNKNOWN.
2. **Use the latest authorized decision.** Apply the owner's newest explicit decisions when they supersede older plans; reconcile conflicting documentation.
3. **Inspect before changing.** Identify authoritative repositories, deployment targets, affected users, dependencies, schemas, provider settings and related builds.
4. **Preserve strategically placed duplicates.** Never delete, overwrite, rename, merge or move seemingly duplicate files until each copy's separate consumer and purpose is verified.
5. **Preserve unresolved files.** If no proven unused status or safe replacement exists, leave all copies intact and record the unresolved question.
6. **Preserve historical evidence.** Do not discard branch records, migration contracts, release receipts, old tests or reference documentation merely because production code moved.
7. **Avoid destructive Git operations.** Never reset, hard-revert, force-push, bulk-delete, or wholesale-merge diverged branches without verified safety and required authorization.
8. **Keep one canonical product.** Use interplanetarysister/InterplanetaryFund with apps/web as the canonical website, not multiple competing IFund builds.
9. **Follow current architecture.** Use Cloudflare Pages/Workers/R2 plus Supabase Auth/Postgres/RLS, with GitHub as source of deployable code.
10. **Retain legacy reference correctly.** Keep the original Base44 APK/repository read-only as a behavioral and migration reference until verified parity; do not spend unnecessary builder credits.
11. **Do not resurrect retired stacks.** Do not deploy Vercel/Convex or obsolete interplanetary-fund-backend for current iFund work.
12. **One durable source of truth.** Use Supabase for application records and Cloudflare R2 for media; do not duplicate durable user or financial records in KV/D1.
13. **Preserve identities and records.** Never merge owner IDs with campaign IDs or discard imported mapping, account history, media checksums or financial audit data.
14. **Implement end to end.** Finish UI, backend, auth, permissions, persistence, mobile/error states, migrations, integrations, tests and acceptance as required.
15. **A PR is not a completed feature.** Do not stop at a plan, comment, PR, code commit or successful build; verify deployment and actual intended behavior.
16. **Continue through blockers.** Diagnose and repair failures rather than stopping after each test, success or interval; report genuine external limitations accurately.
17. **Revisit truncated work.** Inspect deferred, paused, disconnected, stubbed, mocked, skipped, failing and incomplete tasks before declaring a milestone finished.
18. **Prevent regressions proactively; repair before building.** Before any checks, test suite, build or deployment, audit the changed behavior and its dependencies, proactively fix identifiable defects and regressions, and add focused positive/negative regression coverage. Only after this preflight repair pass, run checks/builds; if those checks reveal additional problems, repair them and repeat verification. Never use a test/build as a substitute for the initial repair audit.
19. **Bring reviewed work into main.** Reconcile relevant feature branches with current main safely; retain unique changes and avoid stale branch merges.
20. **Do not burn GitHub Actions minutes.** Use local testing and controlled Cloudflare manual builds while Actions minutes are exhausted.
21. **Default to zero mandatory costs.** Prefer free services, budget-checked quotas and open-source tools; do not activate metered or paid providers without approval.
22. **Conserve shared Cloudflare limits.** Treat free plan quotas as account-wide when applicable; distinguish project-specific limits and track real consumption.
23. **Keep deployments controlled.** Keep automatic Git-connected Pages deployments disabled unless explicitly authorized; use reviewed immutable previews before production.
24. **Verify before production publishing.** Confirm route tests, provider security, live/browser functionality and rollback; require the applicable production release authorization.
25. **Do not claim what is unverified.** Separate source implemented, built, preview verified, deployed and role/provider accepted; never report simulations as live receipts.
26. **Test as the correct user role.** Exercise guests, members, campaign owners, nonowners and administrators with legitimate identities and mobile-sized browser paths.
27. **Protect secrets.** Never place service keys, refresh tokens, passwords, signed receipts or private files in frontend bundles, commits, logs or shared AI context.
28. **Enforce server-side ownership.** Supabase RLS and verified identity are authoritative; reject cross-owner reads/writes even if a UI hides the controls.
29. **Keep user and provider consent explicit.** Recheck consent scope, current authorization, revocation and provider permissions for consequential external actions.
30. **Internal AI permission is not external approval.** Agent training, account signup and shared context never authorize cross-site posting, payment, account creation or private-data disclosure.
31. **Protect payment integrity.** Require signed provider events, durable idempotent ledger entries, refunds/reversals and reconciled balances; never invent gifts.
32. **Apply the first-party withdrawal fee correctly.** Deduct the platform's 7% fee only once at withdrawal, using provider-cleared funds and verified owner-only withdrawal controls.
33. **Keep outside hosts as direct checkouts.** External fundraisers collect donations through their own providers; iFund does not reroute those funds or apply first-party withdrawal fees.
34. **Separate verified and reported metrics.** Clearly label user-reported, scraped/public, tentative, sandbox and provider-verified campaign totals and opportunities.
35. **Use authorized OAuth connection flows.** Ask users to connect an external site through the supported provider consent window and store token access in protected backend systems.
36. **Never invent connection capability.** If OAuth/API permissions, provider billing or credentials are unavailable, show an accurate manual or unavailable state.
37. **Build for nontechnical users.** Minimize clicks and form complexity; use understandable language and simple defaults rather than developer-first interfaces.
38. **Honor mobile-first accessibility.** Support readable interfaces, comfortable touch targets, narrow screen layouts, keyboard access and reliable sidebar/navigation scroll.
39. **Preserve the cosmic design system.** Use trustworthy Cosmic Geometry, subtle luminous geometry, nebula depth and readable financial/campaign content.
40. **Keep the What If? Mission default.** New prompts begin as private owner-scoped Missions; guests may explore provisionally but saving requires a confirmed account.
41. **Keep fundraising optional.** A Mission does not require a fundraising goal or story; explicitly convert to a separate campaign only at user choice.
42. **Keep campaign creation simple.** Retain the three-step save-or-publish editor; no required user story length, and no editorial score blocking publication.
43. **Use reviewed AI-writing targets.** Generate five title ideas, two summaries and one 1,000–2,500-character AI story when requested; allow section-level regeneration.
44. **Move advanced guidance to Command Center.** Keep readiness analysis, editorial review and deeper refinements optional, separate from simple campaign publishing.
45. **Keep the nine-agent team coordinated.** NEXUS coordinates STORY, ECHO, PULSE, ORBIT, POLARIS, FORGE, LINK and DISCOVER without inventing backend capabilities.
46. **Share owner-scoped agent context safely.** Allow all a member's agents to use relevant authorized team context, respecting corrections, redaction and account isolation.
47. **Require capability registration.** An agent skill document or prompt never grants a live tool. Verify implementation version, provider, cost status, roles and audit receipts.
48. **Keep builder and member-agent browser skills separate.** OpenCode Playwright is local QA; user-facing browser research requires its own registered, authorized, bounded backend adapter.
49. **Keep agents supervised for external effects.** Consequential publication, outreach, permission changes, financial or destructive operations need verified approvals and auditable receipts.
50. **Use consent-driven social sharing.** Provide per-channel drafts/manual/ask/auto settings only where independently approved and connected; preserve attribution and revocation.
51. **Retain owner-only admin access.** Verify super-administrator claims server-side; never grant builder, financial or operations privileges from an email string or UI flag.
52. **Make subscriptions real before charging.** Do not activate paid tiers or promises before provider-verified subscription state, matching entitlements and checkout acceptance.
53. **Enforce optional campaign email pricing.** A campaign @interplanetaryfund.com identity requires an active paid subscription and explicit $1/month Basic add-on with verified mail routing.
54. **Treat account erasure as a protected workflow.** Support deletion and cancellation with legitimate identity, staged document cleanup, financial retention and audit; never blindly erase records.
55. **Keep mobile releases independently compliant.** Check iOS/Android account deletion, onboarding, user-generated content, permissions, store policies, signed packages and real-device behavior.
56. **Do not silently enable payment methods.** Google Pay, crypto or other alternatives need actual provider support, compliance and verified sandbox receipts before customer activation.
57. **Keep internal content truthful and helpful.** Articles, news, social posts, images and videos should explain iFund positively without inventing metrics, partnerships or outcomes.
58. **Continue specialist training safely.** Use reviewed current evidence, role-specific lessons and weekly training; do not confuse notes with real model weights or verified skills.
59. **Preserve learning and platform account mapping.** Maintain current architecture decisions, changes, hosted provider accounts and which authorized email belongs to each platform in protected records.
60. **Document and audit outcomes.** At each release report precise commits, tests run, deployment IDs, live role acceptance, unknowns, blockers and rollback status.
61. **Honor user control above convenience.** Keep working campaigns, draft ownership, original writing, explicit action approval and reversible settings intact; user experience comes first.

## Reporting format

At the end, distinguish **restored/implemented**, **tests executed**, **live or preview verified**, **blocked/unverified**, and **unresolved history**. A passing test does not prove provider acceptance. Never claim that a repository file edit has updated ChatGPT's separate personal memory controls; repository policy is persistent versioned builder guidance.
