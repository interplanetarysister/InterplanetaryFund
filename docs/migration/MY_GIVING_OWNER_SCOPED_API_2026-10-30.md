# My Giving owner-scoped API — 2026-10-30

## Scope and source contract

The authoritative source implementation is \`base44/functions/getMyGiving/entry.ts\` in \`interplanetarysister/interplanetary-fund2\`, with the original \`src/pages/MyGiving.jsx\` and \`base44/entities/Donation.jsonc\` contract. It returns only verified gifts belonging to the authenticated donor and preserves campaign identity/title, campaign gift amount, optional platform contribution, processing fee, total charged, donor name, recurring state, payment method, and source creation date. A read-only query of the authoritative Base44 \`Donation\` entity returned **0 records**, so there is currently no legacy Donation payload to import.

## Staged target implementation

- Canonical read endpoint: \`GET /api/me/giving\`.
- Compatibility alias retained: \`GET /api/giving/mine\`.
- \`worker/givingRepository.js\` forwards the caller's verified JWT and the public Supabase key to the \`public.ifund_my_giving()\` RPC. It never reads a client-supplied donor ID and never uses a service-role key.
- \`worker/givingReads.js\` retains the migration preview gate, confirmed-email requirement, and active-account lifecycle check before calling the repository.
- \`public.ifund_my_giving()\` is staged under \`supabase/migrations/pending/\`. It derives the donor from \`auth.uid()\`, checks the active-account predicate, requires both the source User-to-Auth mapping and the Donation row owner mapping, requires a verified matching \`Donation\` source snapshot, and includes only \`payment_verified = true\` legacy gifts. It also includes only captured PayPal ledger rows owned by the caller. Exact provider references are used internally for de-duplication and are not returned to the browser.
- The page no longer hardcodes PayPal-only history or creates campaign links from untrusted legacy IDs. It displays the actual payment method, recurring status/monthly amount, optional platform support, and processor/total amounts only when recorded. Missing source dates are shown as unavailable rather than replaced with migration timestamps.

## Live database evidence (read-only, 2026-10-30)

- \`ifund_finance.donation\` exists and contains **0 rows**; this agrees with the direct Base44 source query returning 0 Donation records.
- \`ifund_stage.user\` contains **10 rows; 0 have \`owner_auth_uid\` mapped**.
- \`ifund_transfer.source_snapshots\` contains **520 rows total**, but **0 \`Donation\` snapshots**.
- \`public.ifund_donations\` contains **0 rows**.
- The private \`ifund_finance.donation\`, \`ifund_stage.user\`, and \`ifund_transfer.source_snapshots\` tables have RLS enabled and explicit deny-client policies. The new RPC keeps those tables private.
- The operational donation table has donor-only captured-gift RLS. \`paypal_order_id\` and \`paypal_capture_id\` are not selectable by \`anon\` or \`authenticated\` roles.
- Three Auth profiles exist; all three still have NULL \`account_status\` and NULL \`account_deletion_pending\`, so the existing lifecycle guard correctly blocks them until source ownership is reconciled.
- \`public.ifund_legal_acceptances\` exists but has **0 rows**. Auth redirect and confirmation-email configuration remains unverified through the connected project-detail interface.

## Verification performed without a build

- 16 focused Node tests passed locally: route gate, confirmed email, lifecycle fail-closed behavior, canonical and compatibility paths, RPC auth forwarding, malformed/duplicate financial rows, source-field normalization, safe legacy campaign/date handling, SQL security contract, provenance/identity constraints, and page contract. Auth/profile/RPC network responses were mocked; this is not live-user runtime verification.
- \`node --check\` and \`git diff --cached --check\` passed for the staged Worker JavaScript and patch files.
- All staged migration preflight predicates passed in a read-only catalog audit. A read-only \`EXPLAIN (FORMAT JSON)\` of the staged RPC's SELECT/CTE query succeeded against the current database schema. These checks validate current schema shape and query planning only; they do **not** prove the function has been installed or run under a real user JWT.
- No SQL migration was applied. The RPC migration remains pending until the applied migration history, verified Donation snapshots, and source-user identity mappings are reconciled.
- No npm build, Vite build, Cloudflare build/deploy, GitHub Actions run, deployment retry, DNS change, payment operation, or production configuration change was performed.

## Explicitly incomplete

- The current database has no Donation snapshots, no mapped source users, and no finance Donation rows; there is no real donor record available for end-to-end ownership verification.
- The staged RPC has not been installed or executed under real donor JWTs. Production/runtime validation is pending.
- The source recurring-management actions (pause, resume, cancel) still need their own verified owner-scoped backend behavior. This slice displays recurring state read-only; it does not pretend those controls are implemented.
- Supabase reports **32 applied migration versions**. The repository tracks **7 SQL files**, but only **6** match applied versions; **26 applied SQL artifacts are missing**, and \`20261025011400_initial.sql\` is tracked but is not in the applied-version list. The authoritative source repository contains only one SQL migration file, so it does not supply the missing artifacts. Recover the exact missing applied migration artifacts before applying this or other pending migrations.
- Full route parity, all original backend functions/dependencies, workflows, agents, connectors, Android behavior, legal signup flow, and independent provider/browser verification remain outstanding. The platform release gate remains **NOT READY**.

## Branch and release state

This work is staged on \`migration/nonbuild-inbox-20261030\`, based on the current PR #165 draft head. PR #165 itself was not advanced because its push workflow runs \`vite build\`. The auxiliary branch has no matching GitHub Actions push workflow, and the Cloudflare migration project's preview setting remains \`none\` with production deployments disabled. No preview or production artifact was built or deployed.
