# Deferred admin Builder Agent

## Capability to preserve

Administrators need an in-app assistant that can inspect operational evidence,
diagnose defects, and preserve a repair plan without changing payments,
permissions, ownership, credentials, or production source directly.

## Why it is deferred

Current Base44 documentation exposes login-only conversation methods but no
verified per-agent admin-role authorization gate. The repository therefore has
no verified, non-bypassable way to restrict a named agent to the admin role.
A role check in the Platform page or chat component protects only that user
interface. An authenticated non-admin could still call the named agent through
the direct API.

The `builder_agent` configuration, Platform-console panel, direct chat route,
and runtime aliases are intentionally absent. Prompt text,
`allow_anonymous_access: false`, client-side role checks, and a separate
interaction-log function are not server-side authorization for conversation or
tool execution.

Do not replace the deferred agent with a metered or unverified proxy. Retain the
capability here until Base44 provides the required native authorization
boundary.

## Safe restoration contract

Restore the capability only after hosted evidence proves that conversation
creation, message, subscription, and tool execution are all protected by a
server-enforced admin-role boundary which cannot be bypassed through the
Base44 SDK or direct API calls. Required evidence includes:

- an authenticated non-admin direct API request is denied before a conversation
  is created, read, subscribed to, messaged, or allowed to execute a tool;
- an authenticated administrator can complete the same operations;
- every exposed entity and function independently enforces least privilege;
- secrets, provider credentials, payment data, and private records are never
  exposed to prompts or responses;
- consequential actions require explicit confirmation and create truthful audit
  records;
- negative authorization tests run in the release gate;
- the implementation does not require paid or protected credits merely to
  preserve the security boundary.

Until that contract is supported and independently verified, administrators
must use the existing Platform panels and repository-owned repair workflow.
