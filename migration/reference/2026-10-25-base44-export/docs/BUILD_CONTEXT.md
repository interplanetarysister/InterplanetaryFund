# Build Context — Interplanetary Fund User-Facing Application

> **Purpose:** obvious, durable source of commonly needed build information for all agents working on this repository.
>
> Update when architecture, ownership, deployment, agent workflow, or integration facts materially change. Never store secrets, private keys, tokens, or credentials here.

## Platform purpose
This repository contains the user-facing application layer for Interplanetary Fund: campaign creation and management, fundraising UX, campaign intelligence, AI-assisted outreach, subscriptions, and user-facing financial workflows.

## Frontend stack — authoritative correction

This application is a **React + Vite application, not a Next.js application**.

Verified from `package.json`:
- React 18 (`react`, `react-dom`)
- Vite 6 (`vite`, `@vitejs/plugin-react`)
- React Router (`react-router-dom`)
- Base44 Vite integration (`@base44/vite-plugin`)
- Production build command: `vite build`

There is no `next` framework dependency and no Next.js build command. `next-themes` is present as a React-compatible theme utility; its name must not be interpreted as evidence that this repository uses Next.js.

**Documentation rule:** future agents must describe the frontend as React + Vite/Base44 and must not call it Next.js unless a deliberate, reviewed architecture change introduces Next.js.

## Repository relationship
The authoritative backend/agent-orchestration layer is `interplanetarysister/InterplanetaryFund`. Do not create a competing backend or silently move source-of-truth responsibilities without documenting and reviewing the architectural change.

## Agent responsibilities
- **Agent 1:** primary implementation/development.
- **Agent 2:** lead engineering/review and coordination.
- **Agent 3:** independent verification/QA/security review.

Builders must modify existing produced work rather than recreate it from scratch. Replacement is exceptional and must be justified and verified.

## Durable workflow
Build once → review → correct the existing implementation → independently verify → approve/merge. Running a build/test during verification is validation, not a second implementation.

## Financial trust boundary
Client/UI input must never be treated as authoritative payment, donation, withdrawal, or payout state. Server-side authorization and verified payment-provider evidence establish financial state.

## AI authority boundary
AI agents must operate within explicit campaign/user authority. Actions with external side effects require the appropriate authorization. Hiding a UI control is not authorization; backend enforcement is required.

## Page/action documentation
Any agent working on a page or workflow must understand and document all accessible actions, route/entry conditions, backend functions/entities, authorization requirements, data effects, external side effects, failures, audit behavior, and subscription requirements where applicable.

## TLS / production security
Do not commit production certificate/private-key material. Live certificates belong at the hosting/TLS provider. GitHub stores configuration, policy, and verification documentation. Production hostname and certificate status must be independently verified before certification.

## Verification
Consequential changes require exact test/check results and remaining limitations to be documented in the relevant PR or issue.

## GitHub source of truth
Important build knowledge, findings, corrections, and verification results must be recorded in an obvious, durable GitHub location accessible to all agents. Never leave important project knowledge only in chat.
