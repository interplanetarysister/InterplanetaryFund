# Interplanetary Fund — Current Product System Contract (2026-11-20)

**Purpose:** preserve the distinct root-level product architecture contract from the earlier multi-repository era while updating its facts. `AGENTS.md` and `docs/architecture/IFUND_BUILD_CONTRACT_2026-11-03.md` supply detailed execution requirements. This file is **not** an authorization to migrate old runtimes.

## Canonical product and platform

Interplanetary Fund is **one cohesive product**, not multiple disconnected campaign databases. Canonical source: `interplanetarysister/InterplanetaryFund`. Canonical application: `apps/web`. Hosting: Cloudflare Pages + Workers, R2 for media. Canonical durable relational data: Supabase Postgres/Auth with owner-scoped RLS, production project `ssibsfmtodgximseeqsv`. GitHub is deployable code history; externally hosted fundraiser links direct supporters to the host's own checkout. The former `interplanetary-fund-backend`, Convex and Vercel paths are retired and must not be restarted. Base44 `interplanetary-fund2` remains a read-only behavioral reference until explicit parity/cutover acceptance.

## Identity, capability, money and data invariants

- Use stable canonical owner identities and campaign IDs; never equate the two or infer an account owner from an email string.
- Supabase owns business records and provider-verified payment ledger. R2 owns document/media object bytes; no parallel durable D1/KV database or Supabase Storage media copies.
- First-party PayPal deposits require signed, idempotent provider evidence; the 3% platform fee applies **once at withdrawal**. Owner-only withdrawal requires cleared balance, verification and durable reservation. External provider fundraising pays that provider directly; outside amounts are source-labeled and never counted as verified IFund donations.
- User-facing agents operate within verified owner consent and tool scopes. Internal collaboration does not authorize external publishing, account creation, donation claims, or money movement. No model can grant itself permissions via a skill or a prompt.
- A successful source build or nonauthenticated UI view is not end-to-end acceptance. Verify identities, network/runtime wiring, database ownership/RLS, provider receipts, mobile usability and rollback before claiming a live capability.

## Current product direction

Prompt-first **What If?** creates owner-private Missions, with optional independently opted-in fundraising campaigns. Existing three-step campaign editor remains available; no minimum user story length; AI story target 1,000–2,500 characters; extra refinements belong in Command Center. User-facing simplicity and trustworthy modern cosmic geometry guide UX. Paid services must not be activated without verified opt-in and economics.

## Changes and preservation

Before retiring any file/repository/runtime, verify the separate consumers and preserve unique user functionality, reference evidence, workflows and migration contracts at their rightful paths. Keep all incomplete work visible in a bounded implementation ledger. Follow manual preview-first deployment control; do not assume GitHub Actions minutes are available. Final production publication is a distinct approval and acceptance step.
