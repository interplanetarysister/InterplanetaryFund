# Build Context — Interplanetary Fund

> **Purpose:** obvious, durable source of commonly needed build information for all agents.
>
> Update this file when architecture, ownership, deployment, agent workflow, or integration facts materially change. Do not store secrets, private keys, tokens, or credentials here.

## Platform purpose
Interplanetary Fund is an AI-powered fundraising operating system intended to coordinate campaign fundraising, AI-assisted growth/outreach, cross-platform fundraising intelligence, and controlled financial workflows.

## Repository role
This repository is the authoritative backend/agent-orchestration layer for the Interplanetary Fund platform. The user-facing application is maintained separately in `interplanetarysister/interplanetary-fund2`.

## Agent responsibilities
- **Agent 1:** primary implementation/development.
- **Agent 2:** lead engineering/review and coordination.
- **Agent 3:** independent verification/QA/security review.

Builder agents must modify existing produced work rather than recreate it from scratch. Replacement is exceptional and must be justified and verified.

## Durable workflow
Build once → review → correct the existing implementation → independently verify → approve/merge. Verification may run tests/builds; verification is not a second implementation.

## Financial trust boundary
Client/UI claims must never become authoritative financial state. Payment-provider evidence and server-side authorization/validation establish financial state. Donation, ledger, withdrawal, and payout operations require server-authoritative controls and auditability.

## AI authority boundary
AI agents may analyze/recommend/draft, but actions with external side effects require the appropriate campaign/user authorization. UI visibility is not authorization; backend enforcement is required.

## Page/action documentation
Agents working on a page or workflow must understand and document its accessible actions, route/entry conditions, backend functions/entities, permissions, data effects, external side effects, failures, audit behavior, and subscription requirements where applicable.

## Source-of-truth rules
Do not create competing implementations or silently change repository ownership boundaries. Check the existing implementation and related repositories before adding new architecture.

## TLS / production security
Production certificate/private-key material must not be committed to GitHub. The hosting/TLS provider manages live certificates. GitHub stores deployment configuration, policy, and verification documentation. The production hostname and certificate must be independently verified before TLS is certified.

## Common verification requirements
For consequential changes, record the exact tests/checks performed, their results, affected routes/entities/functions, and remaining limitations in the relevant PR or issue.

## GitHub documentation rule
Important build knowledge, findings, corrections, and verification results must be recorded in an obvious, durable GitHub location accessible to all agents. Do not leave important project knowledge only in chat.
