# Feature #10 — Platform Foundation / 10-OS Architecture

## Purpose

Provide one shared application-layer contract for cross-OS events, retries, idempotency, errors, service health, and the Base44↔Convex boundary without creating a competing backend.

## Source of truth

- `interplanetary-fund2` owns the user-facing Base44 application layer.
- `interplanetarysister/InterplanetaryFund` owns authoritative Convex persistence and agent/runtime state.
- Do not introduce a second production event store or agent-memory system.

## Event contract

Platform events must use a registered event name and version and include bounded actor/resource/correlation/idempotency identifiers, an ISO timestamp, and a JSON object payload within the configured size limit. The application helper is transport-agnostic; authoritative persistence is performed by Convex.

## Idempotency and retries

Any retryable side effect must have a stable idempotency key. Application retries are bounded to five attempts and carry the same key through every attempt. Durable deduplication is enforced by the authoritative Convex `taskRelay` boundary. A caller must never manufacture a new idempotency key for a retry of the same logical side effect.

## Safe errors

User-facing platform errors use allowlisted safe classifications. Raw provider/backend error messages, URLs, identifiers, tokens, query fragments, and stack details must not be exposed to users.

## Service health

Health checks are bounded by an 8-second UI timeout. The current Base44 SDK path does not expose an AbortSignal cancellation contract, so timeout means the panel stops waiting; it does not claim to cancel the underlying request. The UI prevents overlapping health runs so repeated checks cannot intentionally multiply in-flight dependency calls.

## Base44 → Convex bridge

The bridge requires:

- an authenticated Base44 caller;
- actor identity matching the authenticated caller;
- `CONVEX_PLATFORM_BRIDGE_SECRET` in Base44;
- matching `PLATFORM_BRIDGE_SECRET` in Convex;
- an environment-specific `CONVEX_PLATFORM_EVENT_URL` using HTTPS.

The Convex HTTP route validates the shared secret and invokes an internal mutation. The public Convex mutation remains independently authenticated and ownership-checked.

## Deployment checklist

Before Feature #10 can be published as production-ready:

- [ ] Configure the production Base44 `CONVEX_PLATFORM_BRIDGE_SECRET`.
- [ ] Configure the matching Convex `PLATFORM_BRIDGE_SECRET`.
- [ ] Configure production `CONVEX_PLATFORM_EVENT_URL` to the deployed Convex `/platformEvent` endpoint.
- [ ] Verify the bridge rejects missing/incorrect secrets.
- [ ] Verify the authoritative `taskRelay` idempotency boundary under concurrent calls.
- [ ] Verify generated Convex API/codegen compatibility.
- [ ] Run application lint, typecheck, platform verification, and production build.
- [ ] Run backend CI/build/codegen checks.
- [ ] Complete independent Agent 2+3 audit and Agent 3 final publication review.

## Traceability

This document implements the #0.5 reconciliation requirement that Feature #10 is the first implementation layer because later Identity, integrations, communications, Campaign OS, AI, trust, distribution, analytics, and community work depend on shared platform contracts.
