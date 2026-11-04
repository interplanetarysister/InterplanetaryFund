# Growth Agent preview

Source: `interplanetary-fund2` at `fb2afc64d72194c51c552bc7b5260a479d7566eb`, Growth Agent contract. Implementation starts from Strategy preview commit `d5e4fbccadf8e8ad61232a189e6956a724f21c3c`.

## Implemented

Growth has its own Cloudflare Worker, independent execution control, authenticated RPCs and member screen at `/agents/growth`. It shares the reviewed transport and selected-recommendation interface with Strategy while keeping separate inference leases, receipts, data ownership and source-specific recommendations.

The context includes current owned campaigns, canonical captured gifts grouped by currency, redacted connection metadata and reviewed writing research. Financial evidence is used only when explicitly available; stale rows marked unavailable are excluded. Amount formatting preserves integer cents without floating-point conversion. Donor identities and credentials do not enter prompts. A connection record does not establish publishing permission, usage or consent.

Reports compare plausible audiences and small ethical experiments as hypotheses, with priorities, risks, uncertain predictions and 3–5 ranked recommendations. Evidence must exactly match supplied facts for the recommendation's campaign. One snapshot never establishes momentum, conversion, retention or underused connections. The actual AI smoke returned low-confidence experiments rather than invented campaign results.

Operational report state is private. Canonical Recommendation, AgentConversationRun, activity and workflow jobs are reused. Growth creates no additional MissionBrief. Accepted/dismissed/imported/other-agent recommendations remain intact. Batch accept/dismiss/reopen saves owner decisions only; it never sends, publishes or changes a campaign.

## Migration and checks

Exact applied migration: `20261104063945_ifund_growth_agent_contracts.sql`, 20,935 bytes, MD5 `6b8ea6c478a735e35ca8a06fd9e1eb74`.

Initial hosted verification: disabled control, zero browser grants on private tables, all five public RPCs security-invoker and authenticated-only, anonymous execute denied. Live AgentConversationRun fields and status constraints were checked before DDL.

Focused checks: five Growth Worker scenarios, ten executable PostgreSQL scenarios, twelve Strategy Worker regression scenarios, eight Growth mocked browser checks and eight Strategy browser regressions. Frontend bundle built. Full root/frontend suites and hosted deployment evidence are recorded after release checks complete.

Actual Workers AI smoke with synthetic campaign data passed exact-fact validation: 666 input / 591 output tokens; about 138.80 neurons. It returned three low-confidence recommendations. No paid service or external communication was activated.

Independent review found and fixed a copied specialist-role mismatch and use of stale financial rows when availability was false. Independent audit is required before release.

## Limits and sequence

Time-window analytics, provider usage measurement, historical correctable learning, creator audience hypotheses not present in the current canonical campaign schema, general multi-kind drafting, conversational history and actual specialist execution remain integration work. This release does not claim full source parity.

Owner's current sequence: Strategy preview → Growth preview → Communications preview → promote those three verified releases to production → begin the following agent. Financial/provider send activation, DNS/mail changes and Base44 retirement remain separate.

Rollback disables Growth's Worker/database control and restores the prior Pages artifact while preserving canonical data and migration history.
