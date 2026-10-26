# Shared OBO Agent Capability Contract

This contract captures the immediate implementation requirements for connected platforms and the in-app agent team.

## Connection experience
- A platform is connected once per user, not once per agent.
- The platform picker shows connection health with a small green indicator for a verified working connection and a simple needs-attention/not-connected state otherwise.
- First connection launches one provider authorization flow requesting all applicable supported capabilities in plain language: read, write, post, comment, message, follow/join, donation/balance status, and withdrawal/transfer.
- OAuth scopes, APIs, PATs, tokens, refresh and webhook details are implementation concerns and are not exposed as required user knowledge.
- The connection persists until the user disconnects it, except when the provider expires/revokes authorization or requires reauthorization.
- Never mark an unsupported capability as granted. Provider capability discovery and actual authorization are authoritative.

## Failed connection recovery and failure logging
When an external platform connection fails, connection-capable or connection-assisting agents must preserve the last known-good `PlatformConnection` and reusable connection recipe rather than creating unnecessary duplicates. Identify the failed step, retry transient failures safely, and verify authorization, connector health, provider permissions, endpoints, tokens/sessions, and provider availability. If the current transport is unusable, resolve the next legitimately supported transport in priority order: OAuth → API → webhook → token → authenticated browser → public browser → manual. Save a verified successful recovery path for reuse when appropriate. Never mark a connection verified without provider/transport confirmation, and never invent synchronized data, donations, balances, capabilities, or successful actions. Require user interaction only when the provider genuinely requires user-controlled authentication, authorization, or another action that cannot be completed through the existing grant.

Every failed connection attempt and recovery attempt must create an auditable failure/recovery record containing, when available: platform, PlatformConnection ID, timestamp, requested operation, transport, failure stage, sanitized error category/detail, retry/attempt count, acting agent or worker, recovery path attempted, final outcome, and correlation/operation ID. Never log passwords, access/refresh tokens, session secrets/cookies, authorization codes, raw credentials, or unnecessary sensitive financial/personal data. Consequential retries must remain idempotent and must not duplicate posts, messages, donations, transfers, or other external actions.

After recovery, re-verify connection health, persistence, provider-confirmed capabilities, OBO authorization, synchronization behavior, and the requested operation before recording recovery as successful. The same recovery contract applies to the shared live platform capability layer used by both web and installed/app experiences.

## Shared agent access
A verified OBO connection is available to all of the user's agents. Role purpose determines how it is used:
- Communications: campaign-related comments, messages, mentions, replies and updates.
- Outreach: ethical supporter/community discovery, following/joining and engagement where the provider permits it.
- Finance: provider-verified donation/balance status, reconciliation, authorized transfers/withdrawals where supported, fees and net-available ledger state.
- Strategy/Growth: campaign planning plus grants, relief applications and relevant local/government assistance, with separate specialties.
- Chief of Staff: understands the whole team, delegates with context, tracks work, and uses cross-agent conversation context supplied by platform memory.
- Other agents may use the same connections when an action serves their assigned purpose and is authorized.

## Execution
The same capability layer serves both user-triggered and autonomous work. Automation ON permits authorized autonomous actions. User-triggered features invoke the same connection immediately. A provider limitation always wins over an internal request.

## Fluid handoffs
Agents are interfaces into Interplanetary Fund, not isolated chatbots. Preserve campaign/user context when routing between conversation and tools. Drafts and known selections should be pre-populated when supported. Example: Outreach drafts an update, then opens/routes to the campaign update flow with the draft and destination platform already selected.

## Financial custody
Reading an external donation does not make that money held by Interplanetary Fund. Only a provider-verified settlement/transfer into the platform's holding account may become platform-held/withdrawable value. Ledger entries must preserve gross amount, external/provider fees, transfers, refunds/chargebacks, Interplanetary Fund fees, currency, provenance, and net available to the user.

## Memory and training
Agent conversations and instructions should persist for the user through the platform memory system. Chief of Staff receives cross-agent context when available. Each specialist keeps separate role training; verified knowledge can overlap. Delegated real work and verified outcomes are learning signals, but learning never expands authorization.


## Build reference: current implementation to change

Use the existing implementation as the starting point; do not rebuild the connection or agent systems from scratch.

| Requirement | Current implementation to reference | Refinement target |
|---|---|---|
| Connections page / platform selection | `src/pages/Connections.jsx` | Replace/augment the current separate catalog cards with a compact selectable/dropdown-style platform experience. Keep existing catalog data and connection loading. A verified connection should show the small green dot; disconnected and needs-attention states remain simple. |
| First-time connection UI | `src/components/connections/ConnectDialog.jsx` | Keep the existing provider OAuth redirect flow, but before redirect show one plain-language permission window listing the applicable capabilities requested for that provider. User accepts once; do not ask them to understand tokens/scopes/PATs. |
| OAuth finalization | `base44/functions/finalizeAppUserOAuthConnection/entry.ts` | Persist the capabilities actually requested/granted/known supported. Do not assume a capability merely because it appears in our desired capability catalog. Provider response/discovery is authoritative. |
| Connection record | `base44/entities/PlatformConnection.jsonc` | User `ai_obo_consent` is the authorization source of truth. Connection `obo_consent` + `agent_access` are synchronized execution/audit metadata only and must never contradict the owner-level decision. Preserve status, verification, provenance, automation and credential security fields. |
| Connected status | `src/components/connections/ConnectionCard.jsx` | Preserve current health/provenance behavior and use the green dot only for a verified working connection. |
| Existing AI publishing consent | `src/components/connections/AIConsentCard.jsx` and legacy `ai_publishing_consent` checks | Migrate any existing positive IFund AI authorization into canonical `ai_obo_consent`. The user sees one AI/OBO authorization; connected platforms inherit it automatically. |
| Existing update/cross-post engine | `base44/functions/postCampaignUpdate/entry.ts` | Extend rather than duplicate. It already resolves campaign connections, tailors posts, stages drafts/pending approval and auto-publishes authorized targets. Add explicit destination selection/prefill support for agent handoffs. |
| Existing social automation | `base44/functions/runSocialAutopilot/entry.ts` | Reuse its owner/connection/automation/cadence gates. Expand capabilities without bypassing provider or user authorization. |
| Existing external fund observation | `base44/functions/syncExternalFunds/entry.ts` | Extend provider adapters for donation/balance reads. Keep its custody rule: observed external money is not IF-held/withdrawable until a real transfer/settlement is verified. |
| Agent chat | `src/components/agents/AgentChat.jsx` | It currently creates a fresh conversation when switching agents. Add durable per-user conversation continuity and structured handoff context rather than relying only on best-effort interaction summaries. |
| Agent selector | `src/pages/Agents.jsx` | Preserve the existing specialist team. Add tool/workflow handoffs instead of creating a second agent UI. |
| Chief of Staff | `base44/agents/chief_of_staff.jsonc` | Use cross-conversation context plus structured delegation. It should know what was delegated, to whom, campaign/context, status and result. |
| Shared training | `docs/AGENT_TRAINING_CORE.md` and role-specific `.agents/skills/*.md` / `base44/agents/*.jsonc` | Shared principles belong in core training; specialties and executable behavior belong in each role's own training/config. |

## Required refinements before this feature is considered complete

1. **Capability catalog must be provider-specific.** Define desired capabilities separately from provider-confirmed capabilities. Example: Facebook might support page posting but not an arbitrary account action; a crowdfunding provider may expose donation reads but no withdrawal API. The UI may say “We’ll request everything this connection can use,” but stored `granted_capabilities` must reflect reality.
2. **Permission changes need reauthorization.** If a later release adds a capability that was not in the original grant, mark it as needing permission rather than silently treating the old grant as full access.
3. **Disconnect must revoke local agent authority immediately.** Deleting/disconnecting a connection must prevent all agents, queued jobs and automation from using it. Revoke provider authorization where the provider supports revocation; otherwise discard/disable local credentials and mark disconnected.
4. **Queued actions must re-check permission at execution time.** A post/message/withdrawal queued while authorized must not execute after consent is revoked.
5. **Role access is purpose-limited, not credential-limited.** Agents share the connection but never receive raw credentials. All external actions go through server-side capability functions that check user ownership, connection status, provider capability, OBO grant, role/action purpose and automation/approval state.
6. **Financial transfer is separate from financial observation.** Add provider-specific transfer/withdraw adapters only where legitimately supported. Record requested amount, provider transfer ID, gross, provider fee, IF fee, refund/chargeback adjustments, currency, settled amount and net user-available amount. Never manufacture a “withdraw” action for a provider that lacks one.
7. **Idempotency/audit is mandatory for consequential actions.** Posting, messaging, joining/following and financial transfers need operation IDs, timestamps, acting agent, user/campaign, provider, capability used, result and retry state so automation cannot duplicate work.
8. **Cross-agent memory needs structure.** Conversation text can inform the Chief of Staff, but delegation should also create a structured task/handoff record. User-specific facts remain separate from generalized agent training.
9. **Agent learning uses verified outcomes.** A delegated action can become training evidence only after its outcome is known. Do not train a role to treat a draft, attempted submission or failed interaction as successful.
10. **Grant/relief assistance must distinguish research, preparation and submission.** Strategy/Growth can discover programs and prepare applications. Eligibility, deadlines and requirements should be source-backed/current when researched. Actual submission occurs only through a supported authorized workflow and must record what was submitted.
11. **Fluid handoff state should be explicit.** Define a small handoff payload such as `{campaign_id, source_agent, destination_tool, draft_content, selected_connection_ids, requested_action}`. Do not make users reselect known campaign/platform information.
12. **Migration/backward compatibility.** Any existing positive IFund AI authorization establishes the canonical owner OBO grant. Existing and newly connected platforms inherit that IFund authorization automatically. Provider authentication and provider-confirmed capabilities remain authoritative and may still require provider reauthorization when a new provider capability is requested.

## Concrete UX examples

### Example A — first connection
User selects LinkedIn. Interplanetary Fund shows: “Allow Interplanetary Fund’s agents to use this connection for your campaigns?” followed by human-readable items that are actually requestable, such as “See your connected account/page,” “Create campaign posts,” “Read and respond to campaign interactions” when supported. The user taps **Allow & connect** once, then the provider's authorization screen opens. After provider verification the platform row shows a green dot and “Connected.” The user never handles a PAT, OAuth scope name or API token.

### Example B — Outreach -> Update
User tells Outreach: “Make a post about reaching 60% and put it on LinkedIn and Facebook.” Outreach reads the user's campaign data, drafts truthful copy, and returns an editable draft. Choosing “Use this” routes to the existing update/distribution flow with `campaign_id`, draft content and the LinkedIn/Facebook connection IDs already selected. If automation is Auto and all permissions are valid, the authorized execution path may publish; Ask stages approval; Draft remains a draft.

### Example C — Communications
A provider-supported campaign comment/message arrives. Communications can read it through the shared connection, use campaign/conversation context to draft a reply, and either send under Auto where that action is explicitly authorized or stage it for approval under Ask/Draft. The audit record identifies Communications as the acting agent and the exact provider capability used.

### Example D — Finance
Finance sees a provider-verified $100 external donation. It reports that $100 is external/observed, not automatically IF-held. If that provider supports an authorized transfer, Finance can initiate the supported transfer workflow. Suppose the verified settlement is $96 after provider fees and an IF fee later applies according to platform rules: the ledger records each component rather than rewriting the donation as $96. User-facing “available” is derived from settled custody and ledger entries, not the external observation.

### Example E — Chief of Staff delegation
User says: “Find any grants that could help this campaign and handle what you can.” Chief of Staff delegates opportunity/eligibility planning to Strategy and discovery/pipeline work to Growth, carrying the campaign ID and user constraints. It can later summarize both agents' findings without requiring the user to repeat the request. Application submission is not inferred from research; it uses the appropriate supported approval/action workflow.

### Example F — revoked permission
User disconnects Instagram after an automated post was scheduled. When the scheduled job runs it re-checks the connection and OBO capability, sees that authorization is gone, marks the operation blocked/cancelled, and does not publish.

## Definition of done
The implementation is complete only when a user can connect once, understand and grant applicable permissions without technical jargon, see connection health simply, use that same connection across appropriate agents, revoke it centrally, and have autonomous/user-triggered actions enforce the same permission gates. Agent handoffs preserve context; Chief of Staff can coordinate cross-agent work; role training remains distinct; financial custody/fees remain auditable; and unsupported provider capabilities are never simulated as working.
