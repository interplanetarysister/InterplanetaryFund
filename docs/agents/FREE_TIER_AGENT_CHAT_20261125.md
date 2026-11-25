# Free-tier agent advisory chat — 2026-11-25

## Current entitlement policy

An authenticated, email-verified member in good standing may ask the nine iFund advisory agents questions without a paid subscription. Free-tier access grants **five completed/reserved questions per UTC day**, enforced in PostgreSQL by the same owner-scoped, idempotent and expiring reservation ledger used for other tiers. The amount is a service-budget guard, not a payment or trial requirement.

Existing paid tiers retain their allowance configuration and verified Premium/Enterprise administrative unlimited-per-account benefits. Provider quotas, security and abuse controls apply to every tier.

## Restrictions retained

- Verified login, active account, matching owner identity, accepted AI consent, and available AI gateway are required.
- Anonymous/guest sessions may browse public agent information, not request private model inference.
- Advisory answers cannot publish, post externally, move funds, authorize account linking, or grant privileges.
- The consent preference remains independently revocable, and membership state alone never grants AI access.
- On failure, the question's reservation is released; repeated request IDs cannot be double-spent.
- Subscription checkout remains optional and is not shown as a mandatory gate to agent chat.

## Source locations

- Main workspace: `apps/web/src/pages/AgentsTeam.jsx`.
- Persistent sidebar: `apps/web/src/components/agents/AgentSidePanel.jsx`.
- Gateway: `worker/agents/teamQuestion.js`, deployed as the dedicated `ifund-agent-question` Cloudflare Worker.
- Limit: `supabase/migrations/20261125184500_ifund_free_tier_agent_chat.sql`.
- Tests: `tests/ifund-agent-team-questions.test.js`.

## Release acceptance

Run relevant local/security tests and web compilation before Cloudflare preview. Confirm preview then promote the verified commit. Apply the SQL migration and update the dedicated agent gateway Worker preserving its existing bindings and modules. Verify that unauthenticated/anonymous users remain blocked and a verified free member can successfully ask a question. Do not claim the latter was browser-tested without a real authenticated session.
