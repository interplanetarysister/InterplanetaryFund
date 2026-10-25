# IFund Phase 7 — reversible cutover preflight (NOT an activation)

Authority: migration issue #137. Production Base44 `ifund2` remains authoritative until full parity is independently verified and the owner explicitly approves activation. Wix DNS/email remains unchanged under the existing host lock. This branch must not trigger GitHub Actions or deploy.

## Readiness proof

Run locally with Node 22: `node --test tests/cutover-readiness.test.mjs`. Then run `node scripts/cutover-readiness.mjs /secure/reviewed-evidence.json`. The program reads only the local evidence file; it never contacts Base44, Supabase, Cloudflare, GitHub, DNS, or payment providers. It exits with code 2 and reports `BLOCKED` when any required proof is absent. `REVIEW_READY_NOT_ACTIVATED` is **not** permission or an activation command: every proof must be independently reviewed, including environment and timestamps. No user tokens, passwords, or personal records belong in the evidence manifest.

## Required verification sequence

1. Independently reconcile every Base44 entity, campaign, media object, ownership record, and SHA-256 digest against the destination. Counts alone are insufficient. Preserve source timestamps and explicit discrepancies.
2. Prove live Base44 and Supabase bearer identities for the same owner, explicit versioned consent, durable audit receipt, cross-owner denial, revocation, and strict tenant RLS. Historical confirmed-email candidates are **not** owner proof.
3. Verify all 95 entity policies, 184 source function entrypoints, 11 connectors, 10 agents, 17 workflows, full frontend parity, CRUD, authentication, delegation redaction, and idempotent retries. Mark intentional retirements explicitly with rationale and tests.
4. Verify PayPal provider settlement, fees, webhooks, withdrawal ledger, and reversals against independent provider records before enabling financial writes. Do not infer settlement from public donation totals.
5. Verify Cloudflare serves the independent app without Base44 proxy fallback, secure owner-link limiter and CSRF bindings, private storage and secrets, and positive/negative live HTTP proof. Never expose private data in test logs.
6. Rehearse rollback using a nonproduction route and documented version IDs. Preserve Wix DNS and mail records; do not change DNS, payment configuration, or shut down Base44 in this phase.
7. Only after all proofs are independently reviewed may the owner separately authorize an activation operation. Activation is outside this script and branch.

## Snapshot at preparation

As of the 2026-10-24 verification: Base44 27 campaigns (17 active, 10 drafts), Supabase 27 campaign shadows, 0 financially authoritative; 3 historical email candidate mappings, 0 session-proven; 26 delegations without consent; 13 cutover controls disabled. The live owner-consent audit table and audited owner-link functions are absent. Cloudflare owner-link limiter, CSRF, and service-role bindings are absent. These are blockers, not passing proofs. The central integration branch is not yet assembled from the phase branches.

## Rollback rules

Before any future deployment, record source and destination versions, affected tables, authorization and tenant-isolation proof, operator identity, immutable audit references, and an independent rollback test. Fail closed on missing data. If a test fails, stop; keep Base44 live and do not change the 13 controls. No automatic rollback script may mutate production without a separately approved, reviewed operation.
