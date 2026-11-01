# IFund AI Chat Actions and Specialist Handoffs — 2026-10-13

## User behaviors now represented in source

- A request such as **"Show me the draft"** reads owner-scoped saved AgentContentDraft and DistributedPost content; the receiving chat agent can display exact content or refer the owner to AI drafts on `/agents`.
- A signed-in human owner submitting exactly **"Approve all drafts"**, **"Approve and publish all drafts"**, or **"Publish all drafts"** triggers `ownerAgentChatActions` from the actual chat composer. No agent is registered with the owner-only function.
- The action enumerates owned, eligible social/campaign/blog/community/external publication drafts. It applies the existing server guarded draft actions. For external content it calls `publishPost` using the actual owner's user-scoped call. For saved blog entries it subsequently publishes with `manageBlog`.
- Existing `DistributedPost` records in draft/pending_approval/approved states go through the same guarded `publishPost` route. Records for other accounts are excluded. Content changes to campaigns/profiles remain separately reviewed rather than silently modifying account settings.
- Actual outcomes distinguish **published**, **applied within IFund**, **approved/manual**, **needs separate review**, and **uncertain**. A manual provider handoff is never counted as published. A failed or unclear operation is not retried automatically, to avoid duplicate public posts. The chat client processes drafts in bounded batches of at most 12 saved AI drafts and 12 existing distributed post records, with recorded IDs excluded from later batches. This prevents manual/approved posts from being retried within the same instruction. The UI reports remaining work if a batch fails or the safety limit is reached. Provider/account data queries are limited to the most recent 500 records per owner path.
- Provider checks, campaign ownership, connection identity, subscription, feature switches and provider-granted permissions remain enforced by canonical write/publishing functions.

## Specialist handoff

- All nine normal agents have `routeAgentTask` with registered role/capability mapping. No agent can route to the admin development builder.
- `dispatch` creates an owner-scoped `AgentDelegation` record, then actually creates a Base44 conversation with the designated specialist and sends the user's exact objective, authoritative campaign ID and minimal non-secret context.
- The record changes to in_progress only if dispatch occurs, and returns a real tracking ID. `status` checks the target conversation; consequential actions remain **needs_review** unless their outcome is independently verified, not merely claimed in agent text.
- The AI Agent Monitor refreshes in-progress handoff statuses while the page is open. Provider connection tasks use their existing managed workflow and are not intercepted.

## Verification and limitations

Run `node scripts/verify-agent-write-capabilities.mjs` and `node scripts/test-agent-chat-actions.mjs`. Code checks do not establish that Base44 has deployed functions, registered tool permissions in the hosted runtime, or that a specific external provider actually posts. End-to-end validation requires a signed-in test owner, a draft, a functioning provider test account, receipt inspection, cross-account isolation checks, and an unauthorized-agent test. Do not mark this feature production verified until those pass.
