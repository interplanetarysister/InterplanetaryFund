# Build & Builder Instructions — NO GUESSING

**Repository purpose: authoritative Interplanetary Fund user-facing Base44 application and consolidation target (`interplanetary-fund2` / ifund2).**

## NON-NEGOTIABLE

**NEVER GUESS.** Verify facts from the actual Base44 project configuration, source, backend behavior, deployment state, or authoritative product records before making changes.

Do not infer architecture, ownership, dependencies, deployment targets, data sources, credentials, API contracts, feature status, or migration status from filenames, assumptions, memory fragments, or stale documentation.

## Evidence hierarchy

1. Explicit current Interplanetary Fund architecture/decision records.
2. Verified Base44 source, configuration, entities/functions, and tests.
3. Current build-agent instructions.
4. Current Base44/backend platform state.
5. Historical documentation.
6. Never use unsupported inference as a fact.

If sources conflict, stop and verify the authoritative source. Do not silently choose one.

## Existing knowledge must be preserved

Do not repeatedly rediscover or overwrite established product knowledge. Treat the current capability registry and migration decisions as persistent state. If new evidence changes a decision, update the authoritative record.

## Authoritative application consolidation rule

`interplanetary-fund2` is the authoritative destination for all user-facing Interplanetary Fund application implementation and updates: Base44/React UI, application entities/configuration, application-layer functions, application agents/workflows, campaign/user UX, and integration surfaces.

Do not implement new user-facing application work in Vercel-only, legacy, duplicate, or historical repositories. Those repositories are evidence/migration sources only unless the owner explicitly reassigns ownership.

Base44/ifund2 is the authoritative application target. Legacy Convex/Vercel implementations are evidence or migration sources only unless the owner explicitly reassigns them. Do not create new user-facing dependencies on retired runtime architecture, and do not expose retired provider/runtime names to users.

When a requested change spans application and supporting services, verify the current owning implementation before editing. Never duplicate state or business logic merely to make consolidation appear complete.

## Provider-specific connection and publishing authorization

Connection specialists must prepare each provider's supported authentication and human-verification path before the user presses Connect. Present one clear Connect action, use existing authorized sessions when available, and route passwords exclusively through provider-hosted login where supported. Do not retain provider passwords in ordinary app entities, frontend logs, agent memory, or prompts. Follow provider requirements for MFA, CAPTCHA, identity verification and terms; never bypass them. Present IFund's plain-language delegated-privileges acceptance/denial at an appropriate point without misrepresenting provider consent or interrupting a required provider-controlled flow. Record provider-specific scopes, verified capabilities, user consent version, timestamp, account identity and revocation path. Display Connected only after the actual promised capabilities are verified.

Connection consent permits approved setup, account management, campaign preparation and other expressly granted OBO tasks; it is not publishing permission. Before any user-account publication, obtain separate explicit approval identifying campaign, content, destination account(s), and one-time or clearly scoped recurring permission. Server-side publishing gates must verify that approval at execution, reject missing/revoked/expired permissions, and audit outcomes. Never silently broaden consent. Keep all provider architecture and suitability research internal to specialist agents; the human-facing experience is Connect, Connected, Reconnect and optional How IFund uses this connection. Apply identically to web and app. Batch full builds and runtime verification with larger release sets rather than after every edit.

## Before every Base44 build

1. Identify the exact Base44 capability being changed.
2. Verify its current implementation and runtime behavior in ifund2.
3. Search other Interplanetary Fund repositories only for missing/newer behavior or evidence that has not yet reached ifund2.
4. Classify each discovered difference as: already consolidated, application migration candidate, backend-owned dependency, historical-only, or UNKNOWN.
5. For an application migration candidate, edit the existing ifund2 implementation rather than replacing it, preserving stable IDs, valid behavior, and interfaces.
6. Verify backend/data ownership and API contracts.
7. Check authentication, permissions, environment configuration, and deployment relationships.
8. Only then implement.

## Human-first prosperity rule

Humans are the purpose of Interplanetary Fund. Users and admins must never be expected to understand internal software architecture in order to use the product successfully.

Every visible word, control, button, field, menu, dialog, state, and workflow must remain readable and understandable before interaction, during hover/focus/selection, while text is being entered, after entry, when disabled/read-only, and in both supported appearance modes. Audit contrast color-by-color and state-by-state; repair noncompliance where it is found rather than masking it with explanatory text.

Every installed function, agent, workflow, page, and subsystem must have a verified purpose that advances safe, lawful Interplanetary Fund success: helping people raise, receive, manage, share, understand, or administer funds and campaigns; improving trust, reliability, reach, accessibility, efficiency, or financial sustainability; or providing necessary platform/security operations. Internal complexity without a current purpose must be consolidated, retired, or kept only as an explicit compatibility tombstone when removal would be unsafe.

Do not promote external platforms for their own sake. Platform-specific architecture, success patterns, and campaign-fit intelligence belong to specialist agents/internal routing unless the human specifically asks for that information.

## Provider-tested publishing rule

Connecting a platform establishes the provider permissions the human approved; it is not recurring permission to publish arbitrary content. For an individual post/share flow, the human's deliberate click on the final **Publish** control is the explicit authorization to publish that exact prepared content to the external destinations selected at that moment. Immediately before submission, show the connected destinations as selectable controls and allow the human to select/deselect them. Never publish to an unselected destination.

A destination may be shown as directly publishable only when current verified IFund capability evidence confirms the exact action works for that provider/account/connection. Use IFund/platform-owned test accounts to pretest provider adapters and record the result in the canonical provider-capability registry so ordinary users are not the first production test. A connected destination whose direct publishing action is not verified must not silently fail or pretend to support publishing. Where provider rules permit a manual share and IFund has actually tested the workflow, offer the tested copy/paste or provider share handoff instead. Label unsupported/unverified actions internally and keep them out of the selectable direct-publish set.

Provider testing must use legitimate provider-supported accounts, APIs, OAuth, share interfaces, and browser flows; respect provider terms, rate limits, CAPTCHA, identity checks, and other required human/provider controls. Never infer capability merely from having credentials or a successful login.

## Validation batching rule

Do not run long production builds, runtime suites, or full validation after every small repository edit. Perform targeted source checks while repairing, accumulate coherent changes, and run full verification at meaningful checkpoints or before publish/release. A repository touch alone is not a reason to consume build/runtime resources.

## One-product rule

Base44 is a component/surface of the **single cohesive Interplanetary Fund product**, not a separate product. Campaigns and other live business entities must use the canonical backend/data identity where the product architecture requires shared state.

Never create a competing production campaign database or silently fork business logic.

## Migration rule

When functionality is being consolidated into ifund2, preserve behavior and stable IDs, identify unique capabilities, and migrate application-owned behavior into the existing canonical implementation. Do not delete or archive a source implementation until production dependencies and equivalent canonical behavior are verified.

Never treat repository presence, a stale UI label, configuration text, or a successful Git commit as proof that a provider or feature is live. Payment/provider availability must be derived from verified runtime/provider capability data. In particular, PayPal/Stripe UI status must reflect actual configured and working payment paths, not assumptions based on frontend labels.

## Unknowns

If a fact cannot be verified, mark it **UNKNOWN**. Do not guess. Escalate only material decisions that cannot be resolved from available evidence.

## Completion rule

Never report a Base44 build as complete merely because the Git repository changed. Verify Base44 publishing/runtime behavior and the affected end-to-end product flow.
