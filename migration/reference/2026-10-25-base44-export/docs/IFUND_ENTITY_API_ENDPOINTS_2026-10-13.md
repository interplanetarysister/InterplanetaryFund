# IFund entity endpoints and integration contracts
Updated: 2026-10-13

## Status and scope
- IFund has 85 entity schemas. Every entity has a top-level purpose description in `base44/entities/<Entity>.jsonc`; these are the primary source for entity API descriptions.
- The two new entities are `ExternalConversation` and `ExternalConversationMessage`. They complement (do not replace) `InboxItem` (event summaries) and `Message` (campaign announcement/broadcast communications).
- `getUnifiedInbox` is a read-only account-scoped backend function. It retrieves existing authorized records; it does **not** connect providers, import remote conversations, or send replies.
- A provider connection or feature flag is not evidence that external inbox reading, replying, campaign publishing, or transfers work.

## Entity API operation descriptions
These are **logical SDK operations**, not claims about newly exposed public REST URLs. Use authenticated Base44 SDK entity operations under the existing row-level security policy and validated server functions for privileged or cross-entity actions.

| Operation | Purpose | Authorization / important rule |
| --- | --- | --- |
| `entities.<Name>.list()` | List available records for one entity. | Enforce entity RLS, pagination, minimum necessary fields. |
| `entities.<Name>.filter(query, sort, limit)` | Retrieve relevant records for a campaign, owner, account, or conversation. | Never allow caller-selected `user_id` to bypass ownership checks. |
| `entities.<Name>.get(id)` | Retrieve one record by ID. | Confirm record ownership and access to any linked campaign/provider account. |
| `entities.<Name>.create(payload)` | Create an allowed user-owned record. | For authoritative, imported, payment, and provider-verified entities, only server-authorized paths should write. |
| `entities.<Name>.update(id, patch)` | Modify an existing record. | Whitelist mutable fields; users cannot self-declare payment verification, a connected provider, a sent message, or granted platform scopes. |
| `entities.<Name>.delete(id)` | Remove a record where permitted. | Check retention requirements, linked records, and whether a durable payment/audit trail must remain. |

## Data ownership and responsibilities

| Entity or entity group | Description and use |
| --- | --- |
| `User`, `PublicProfile`, `DeviceAuthorization` | Account, public identity, and device permission metadata. Authentication and roles remain server-authoritative. |
| `Campaign`, `CampaignUpdate`, `FollowedCampaign` | IFund campaigns, creator announcements, and campaign follows. |
| `Donation`, `FinancialOperation`, `HoldingLedgerEntry`, `WebhookEvent`, `Withdrawal` | Payment mirror, server-authoritative financial operations, balances, webhook deduplication, and withdrawals. Never count an unverified donation as settled money. |
| `PlatformConnection`, `PlatformAccessRegistry`, `AuthorizationGrant`, `AgentDelegation`, `PlatformConnectionRecipe` | The single existing platform account/consent/capability architecture. Reuse instead of creating duplicate connection or agent authorization tables. |
| `FundraisingProviderCapability` | Records what an external provider actually supports and which specific routes have been verified. Unknown capabilities remain unavailable. |
| `ExternalConversation` | One account-scoped external message, social comment, or fundraising-group thread. Deduplicate by provider, connection, and external thread. |
| `ExternalConversationMessage` | Message/comment events within an external thread; store only provider-authorized content, provenance, and confirmed delivery state. |
| `InboxItem` | Concise owner-scoped unified inbox list; `conversation_id`, `connection_id`, `external_message_id`, and `reply_support` associate messages without duplicating full threads. |
| `Message` | Campaign donor communications and announcements, not social-network direct messages. |
| `SocialPost`, `DistributedPost`, `OfficialPublication`, `ScheduledAutoPostPermit` | Native/official social content and approved cross-posting; authorization and provider verification are required before marking published. |
| `SyncRun`, `ExternalSyncEvent`, `ExternalSyncClaim`, `ExternalFundObservation` | Explicit, bounded external-fund sync and informational observations. Do not schedule automatic third-party fundraising sync. |

## Read-only unified inbox function (implemented)

Invoke through the existing authenticated Base44 function invocation mechanism:

- Function: `getUnifiedInbox`
- Method: `POST`
- Input `{ "limit": 20 }` (maximum 50): returns `conversations` and `inbox_items` for the active account only, with safe snippets.
- Input `{ "conversation_id": "<id>", "limit": 20 }`: returns the selected owned `conversation` and its `messages`.
- Errors: `401/403` for invalid or inactive identity; `404` for an inaccessible conversation; `405` for non-POST; `500` for sanitized unexpected errors.
- The function does **not** deliver provider messages, create entries, sync, approve an agent, or authorize replies.
- Existing `updateInboxItem` continues handling only supported owner draft/status updates; it is not a provider reply endpoint.

## Buffer integration boundaries
- Buffer's current public API is a GraphQL API at `https://api.buffer.com`, useful for organizing channels and creating, retrieving, or deleting posts/ideas.
- Buffer's public API does **not** expose reading or replying to comments/DMs as of this document date. Do not mark `messaging_capability` or `reply_support` as verified for Buffer.
- `buffer` is a valid `PlatformConnection.platform` key but a connection must stay disconnected/unverified until authenticated and confirmed by a real provider call.
- Do not store a Buffer token in entity descriptions or public records. Use the existing protected-secret and per-user OAuth/authorization mechanisms as appropriate.

## Deferred provider-specific actions — NOT implemented by this schema change
- Real Buffer posting adapter and multi-user OAuth: require verified provider scopes and consent, then may use existing `DistributedPost` records.
- Instagram/Facebook Page message and comment ingestion: only after provider-approved APIs, correct account scopes, app review where required, and verified webhook/provider requests.
- Facebook fundraising-group content: access is provider-policy-dependent; a public group URL is **not** permission to read private group messages.
- `sendProviderReply`: require owned conversation, verified real-time reply capability, authenticated destination, agent delegation where used, idempotency key, and confirmed provider response; unknown capability means draft or external link only.
- Incoming provider webhooks: authenticate signature, deduplicate, minimize retention, and write linked conversation/message/inbox rows through a restricted service function.
- Funding webhooks and provider ledger reconciliation remain distinct, essential server-side processes regardless of optional user-initiated external fund sync.

## Completion and rollout checks
1. Validate all schema descriptions, required fields, and owner/admin RLS, without changing existing financial or connection records.
2. Verify read-only function authorization with an active account, another user, and an inactive account.
3. Do not expose any native Send control until provider messaging rights are separately proven.
4. Do not claim production inbox import, Buffer connection, or publishing is active until end-to-end tests confirm it.
