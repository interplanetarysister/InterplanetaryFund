# Strategy and bulk recommendation preview

PR: https://github.com/interplanetarysister/InterplanetaryFund/pull/211

This release adds an authenticated Cloudflare Strategy Worker, a member Mission Control screen at `/agents/strategy` and `/mission`, and selected batch decisions. It reuses canonical MissionBrief, Recommendation, activity and workflow-job records; it does not create another campaign or financial ledger.

## Implemented behavior

- Current verified Basic+ entitlement, confirmed active identity and explicit current legal consent are required. Strategy has an independent execution switch.
- A member may analyze the latest 20 owned campaigns or explicitly select up to 10. Truncation is disclosed. Model context and HTTP bodies are bounded.
- The Worker uses the confirmed Free-plan Workers AI JSON-schema model. Evidence must exactly match supplied campaign facts, including its campaign scope. General guidance remains a hypothesis, never verified evidence.
- Captured canonical gifts are grouped by campaign and currency without donor/provider identifiers. This is not legacy-import reconciliation. Hosted donations currently enforce USD; the grouping test also covers future currency separation.
- One living source-specific Mission Brief and 3–5 ranked recommendations commit atomically with the audit/job receipt. Only this agent's previous open suggestions are replaced; accepted/dismissed/imported records are preserved.
- Leases, two global attempts per UTC day for Strategy, one concurrent run per owner, failure consumption and immutable replay receipts prevent repeat inference. Story separately permits two attempts; total configured allowance is at most four calls across the two agents per day. No paid plan was activated.
- Select up to 50 loaded recommendations, review the exact titles, then accept, dismiss or reopen. These are saved decisions, not campaign execution or publication. The server checks every owner's record/revision atomically, rejects duplicate/stale/mixed-owner selections, and replays one stable receipt without sweeping newly arrived records.
- Account changes clear private UI and selection state. Replayed operations reload current canonical state rather than painting an older receipt as current.

## Hosted installation

`20261104061736_ifund_strategy_agent_contracts.sql` is the exact applied migration: 21,024 bytes; MD5 `fc5b79b003ae81278c8cdb4488551f4e`.

Initial live catalog verification: execution disabled, zero browser grants on private tables, all five public RPCs security-invoker, authenticated execute only, anonymous execute denied. Hosted synthetic lifecycle acceptance runs inside one rolled-back transaction; it never accepts an agreement or creates a payment claim for a real member.

## Verification

Root suite: 32 test files passed before evidence tightening. Frontend: 23 test files passed; production bundle built. Focused current tests cover the Worker entrypoint, request authority, scope, AI schema/evidence, replay/quota, negative auth/body cases and nine executable PostgreSQL scenarios. Existing Story/auth browser regression passed 11 checks. Strategy's independent audit passed 10 mocked browser checks, including lost generation response/replay, a 55-item list selecting 50, stale batch handling, exact snapshot retry, new arrivals, account switching and mobile overflow.

A real Workers AI smoke with synthetic campaign data returned a valid three-recommendation plan and exact factual evidence: 435 input / 564 output tokens; about 127.11 neurons. This validates actual model inference and validation, not authenticated member end-to-end behavior. Preview URL, commit, hosted results and final activation state are appended after deployment.

## Explicit parity limits

This is the core planning/recommendation release. Full source conversational history, general correctable memory, multi-kind content draft tools and actual specialist execution remain tracked integration work. External opportunity discovery requires a genuine verified research/search adapter and remains unavailable. A responsible-specialist label is not a completed handoff. No external communication, campaign publication or payment action is granted.

The owner directed beginning Growth once Strategy is pushed to preview, and beginning Communications once Growth is pushed to preview. Preserve these limits when advancing the sequential ledger; do not mark full source parity complete.

## Rollback

Disable the Strategy Worker/SQL execution switch and restore the prior Pages preview artifact. Preserve applied migration history, canonical owner decisions and unrelated jobs. Story production remains PR210's release.
