# Phase 1 — Legacy Payment Capability Migration

**Status:** Incomplete / foundation implemented
**Source audited:** `interplanetarysister/interplanetary-fund-backend/convex/paymentRouter.ts`
**Canonical target:** `interplanetarysister/InterplanetaryFund`

## Findings

The legacy router contains production-relevant Bitcoin donation capability that is not represented by the canonical provider registry: Bitcoin payment intents, BTC/USD rate caching, payment references, expiry, on-chain confirmation polling, confirmation thresholds, retry/backoff, and transaction recording.

The canonical backend already has a provider-capability registry and consolidated transaction/donation/ledger concepts, so the legacy router should **not** be copied wholesale.

## Phase 1 implementation boundary

This phase establishes the canonical compatibility foundation without enabling a new payment flow yet:

- Add Bitcoin to the canonical provider capability registry.
- Preserve explicit provider capability declarations so unsupported operations are never implied.
- Document the legacy Bitcoin behavior that must be migrated in a later phase.
- Preserve human/admin approval and payment authorization boundaries.

## Phase 2 required

Before enabling Bitcoin in production, implement and test a canonical Bitcoin payment service against the current schema and security model, including:

1. Donation-intent creation with idempotency.
2. BTC/USD rate retrieval and bounded cache behavior.
3. Bitcoin payment URI/reference generation.
4. Expiration handling.
5. On-chain transaction lookup and output/address matching.
6. Confirmation threshold handling.
7. Retry/backoff limits.
8. Duplicate transaction protection.
9. Canonical transaction/ledger reconciliation.
10. Failure/refund/expired states and audit logging.
11. Authorization checks and rate limits.

Do not enable or advertise Bitcoin production payments until Phase 2 is reviewed and tested.

## Retirement gate

The legacy backend remains an incomplete dependency until this capability comparison is finished. Do not delete or archive its payment implementation solely because this document exists.
