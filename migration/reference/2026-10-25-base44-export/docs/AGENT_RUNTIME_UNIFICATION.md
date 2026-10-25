# Agent Runtime and Memory Architecture

## Canonical architecture

- Base44 is the authoritative application, agent runtime, and user-facing conversational environment for Interplanetary Fund.
- Base44 native agent memory is the authoritative memory mechanism for the in-app agent team.
- GitHub main contains the authoritative application configuration synchronized with the Base44 app.
- Do not introduce Convex or Vercel as a second agent-memory runtime for ifund2.

## Agent memory configuration

Every normal user-facing specialist agent must have:

- `memory_config.enabled: true`
- `memory_config.scope: "both"`
- `memory_config.include_other_conversation_context: true`

This allows each specialist to retain its own useful context while also receiving relevant context from the user's other conversations. Chief of Staff uses the same capability for cross-agent coordination.

Memory instructions must preserve these boundaries:

- User/campaign-specific facts remain scoped to that user and campaign.
- Generalized learning must not silently convert private user information into shared training.
- Current verified campaign data overrides remembered patterns.
- New explicit user instructions override conflicting remembered preferences.
- Memory never expands permissions, approval scope, financial authority, or external-platform authorization.
- Raw secrets and credentials must never be stored as agent conversational memory. Required integration secrets may be stored and used by the protected backend connection/secret-storage path for authorized platform functionality, while agents and ordinary user-facing reads receive only redacted metadata, connection state, capabilities, or action results.

## Conversation flow

`User -> Base44 Agent Chat -> Base44 conversation -> native Base44 agent memory -> relevant future agent conversations`

The chat UI may create a new conversation session when the selected specialist changes. Continuity comes from the configured Base44 memory system rather than a separate Convex interaction-summary bridge.

## Cross-agent continuity

All seven user-facing agents have cross-conversation context enabled. Specialists may use relevant context from other agent conversations, but should remain focused on their own role. Chief of Staff has the broadest coordination responsibility and should use available cross-agent context to avoid making the user repeat known instructions or decisions.

Structured delegation/task tracking remains separate from conversational memory. `AgentDelegation` is the authoritative Base44 record for substantive cross-agent assignments, including source/destination agent, objective, campaign context, real status, result, and verification. Chief of Staff can create/read/update these records. Conversation memory preserves context; delegation records preserve operational state.

## Campaign context isolation

Cross-conversation memory does not make campaign context interchangeable. Campaign-specific facts, drafts, outcomes, beneficiary details, financial information, and instructions must remain anchored to the applicable campaign ID. A campaign title may be retained for readability, but the campaign ID is authoritative.

Before a consequential campaign-specific action, agents should use the current selected/delegated campaign context and current authoritative records. If remembered context belongs to another campaign, it must not be imported into the active campaign. General user-level preferences may carry across campaigns only when they are genuinely user-level.

Structured `AgentDelegation` records therefore preserve `campaign_id` separately from their context summary. When no campaign applies, the field may remain empty rather than guessing.

## Correction and supersession

Memory is not append-only truth. Within the same scope, a newer explicit user correction supersedes an older user-provided fact or preference, and current authoritative platform state supersedes remembered operational state. Repetition of stale information does not make it current.

Corrections must preserve scope: correcting one campaign does not silently change another campaign, and correcting a campaign-specific instruction does not automatically rewrite a user-level preference.

Structured delegated work uses explicit supersession. If a correction still describes the same assignment, update that assignment. If it replaces the assignment, mark the old `AgentDelegation` as `superseded` and link old/new records with the supersession fields. Completed or superseded historical records may remain for accountability but must not be treated as active instructions.

## Provenance and confidence

Remembered information must retain its epistemic category in agent reasoning: explicit user statement, authoritative platform record, verified external result, agent-generated suggestion, or inference/hypothesis. Generated drafts and recommendations are not evidence that their contents are true, and an agent inference must not silently become a remembered user fact.

For operational facts, current authoritative platform records take priority. For user intent and preferences, explicit current user statements take priority. External, financial, authorization, and completion claims should be rechecked against their authoritative source before consequential action when that source is available.

Structured `AgentDelegation` records may carry `context_provenance` entries for important claims, including source type, a non-secret source reference, and confidence. This is especially important when a receiving agent would otherwise be unable to distinguish a user instruction from an earlier agent's suggestion.

## Credential boundary

Credentials are operational secrets, not conversational memory. When a provider requires a token, API credential, app password, webhook verification value, or similar secret, the platform may securely collect, persist, retrieve, refresh, and use that value through its protected backend connection path as needed for authorized functionality.

Raw secret values must not be copied into agent memory, prompts, delegation records, logs, analytics, or ordinary frontend responses. Agent reasoning should normally receive only whether a credential is configured, connection/verification state, granted capabilities, expiry or reauthorization status when applicable, and the result of the requested provider operation.

This preserves automated platform functionality without requiring users to repeatedly handle credentials and without turning the agent memory system into a credential store.

## Safety

Memory does not:

- grant new permissions;
- approve external actions;
- authorize payments or withdrawals;
- bypass ownership or admin boundaries;
- prove that a requested action was executed.

Remembered claims about external or financial actions must be checked against authoritative current records when those facts matter.

## Verification target

Memory is considered correctly configured when:

1. All seven user-facing agents have memory enabled.
2. Cross-conversation context is enabled for all seven.
3. Chief of Staff can use relevant context from specialist conversations.
4. Switching agents does not require a Convex/Vercel memory bridge.
5. User-specific memory remains separate from generalized training.
6. Current authoritative data and permissions override remembered information.

