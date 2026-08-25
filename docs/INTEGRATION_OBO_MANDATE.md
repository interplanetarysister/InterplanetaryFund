# Interplanetary Fund — OBO Integration & Agent Delegation Mandate

This document is the canonical execution mandate for the external lead integration agent operating on behalf of the human account holder. It must be executed using only legitimate permissions and delegated agents.

## Execution order

1. Inventory agents, permissions, workflows, repositories and existing integration branches.
2. Reconcile existing work before creating duplicate implementations.
3. Delegate specialized tasks to authorized agents.
4. Implement real provider integrations and financial reconciliation.
5. Validate security, ownership, idempotency and concurrency.
6. Run Development runtime tests.
7. Agent 2/3 review and Agent 1 corrections.
8. Agent 3 final publication only after exact-head evidence passes.

## OBO boundary

The human account holder authorizes project coordination, delegation, implementation, issue/PR management and deployment where the connected account permissions permit it. No agent may bypass provider authorization, expose secrets, fabricate credentials, impersonate a user outside granted authorization, or claim success without real evidence.

When a provider requires human authorization, report the exact provider, account, scopes/permissions, authorization location, continuing agent and next action. Do not make the human perform work an authorized agent can perform.

## Financial invariants

- `userId` and `campaignId` are separate identifiers.
- Never use a campaign ID as a user ID.
- Never migrate or create a donation without verified external-donation/transaction evidence or an explicitly authorized, auditable reconciliation path.
- Withdrawals never reduce donation totals.
- Provider withdrawal fees are separate financial records and are displayed only after provider confirmation.
- Historical donations remain in campaign total/goal progress.
- Post-connection donations may be separately attributed to Interplanetary Fund in owner financials.
- Public/non-owner views expose only total raised, not external platform financial details.
- Only campaign owners can access withdrawals, balances and private external financial information.
- Public campaign links resolve to outside-viewer campaign views.

## Required systems

### Count my Money
Owner-only action. Immediately reconcile all authorized supported platforms across every owned campaign. Return per-provider/per-campaign results, new/reconciled/pending/failed/discrepant totals, last-run state and reauthorization needs. Repeated execution must be idempotent.

### Daily reconciliation
Use the same reconciliation engine once daily. Shared Convex writers must be serialized and concurrency-safe.

### External providers
Implement and verify official capabilities for Stripe, PayPal, GoFundMe, Kickstarter, Indiegogo, Facebook Pages, Instagram Business/Creator, TikTok, LinkedIn and Ko-fi where supported. Never invent APIs or bypass provider restrictions.

### Publishing
Linked social accounts provide durable account-level authorization. Publishing must use real provider APIs, ownership validation, durable claims, idempotency, safe retries and provider-aware recovery.

### Campaign media
Externally published campaign media must carry the approved Interplanetary Fund manager attribution/tagline and authoritative Interplanetary Fund logo at the bottom. Recover the exact approved asset from the Base44 Android APK/opening-screen source if necessary; never invent a replacement. Keep branding understated.

## Agent capability rule

Prefer existing authorized agents. Delegate repository/code, OAuth/integrations, payments, Convex/Vercel infrastructure, security, QA/audit, mobile/assets and documentation to agents with those capabilities. If none exists, document the missing capability and prefer a no-cost GitHub Actions + Node.js/TypeScript or Python agent before recommending paid infrastructure.

## Completion rule

A feature is not complete because a button, OAuth page, mock, placeholder, PR or static test exists. Production-ready requires real provider behavior in the intended environment, server-side authorization, protected secrets, idempotent retry/concurrency behavior, runtime evidence and final independent audit.

See GitHub Issue #38 for the complete operational mandate and provider-specific requirements.