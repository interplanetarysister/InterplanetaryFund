# Single-Supabase IFund consolidation — verified state 2026-10-27

**Owner directive:** retain only one Supabase project for Interplanetary Fund, after
verified and recoverable migration of all necessary data, identities, functions,
mail, agents, workflows, and API integrations.

## Destination and older dependency

- **Retain:** `InterplanetaryFund` — `ssibsfmtodgximseeqsv`.
- **Retire after verified switchover:** `Ifund` — `tzehxfikoslihnclhxuz`.
- **DO NOT DELETE SOURCE YET.** It still has three deployed mail Edge Functions,
  business and outreach mail schemas, private migration tables and project-specific
  Auth users. Existing Cloudflare Worker points at this older project.
- Destination owns 79 entity-stage, 12 finance, 4 secrets, 4 transfer and 4 public
  app tables. Its public tables had 0 rows and it had 0 deployed Edge Functions
  during this audit. Its `ifund_transfer` schemas already stage 27 campaigns,
  266 content records and 475 source snapshots. None is permission to publish
  financial data or automatically claim donor/account ownership.
- The older project has 27 campaign shadows, 397 activity shadows, 26 agent
  delegation shadows, 266 content shadows and 10 owner identity mappings,
  alongside email/workflow structures. Reconcile overlapping records rather
  than loading duplicates.
- Authentication is NOT interchangeable between the projects. The older project
  showed four Auth users and zero sessions; the destination showed one Auth
  user and one session. These are aggregate counts, not proof of user identity.
- Cloudflare Pages production uses the destination for `VITE_SUPABASE_URL`
  but the older project for `SUPABASE_URL` and `SUPABASE_JWKS_URL`.
  The deployed `interplanetary-fund2` Worker still points at the older project.
  **This must be repaired atomically after the destination backend is ready.**

## Completed in this consolidation slice

The private `ifund_ops` workflow queue schema has been **created on the destination**
using `supabase/migrations/20261027_single_project_workflow_foundation.sql`,
including 3 empty tables, RLS, constraints, indexes and 3 source-matched
non-SECURITY-DEFINER PostgreSQL routines. Its enabled controls remain absent;
default for a new control row is disabled, no worker was started, and schema
USAGE for `anon`, `authenticated`, and `service_role` is denied.
This is schema portability, **not** an active workflow implementation.

The original empty `business_mail` (4 tables) and `outreach_mail` (5 tables) schema structures are also **created on the destination** via `supabase/migrations/20261027_single_project_mail_foundation.sql`. All 9 tables have RLS enabled and no public, authenticated, or service-role schema access. Zero source mail/outreach records existed during the inventory. This migration did **not** port the privileged mail RPC, Edge Functions, credentials, Auth links, provider routes, mail contents, or SMTP/send capability; inbound/outbound production traffic remains on the older project.

`npm run check:deployment` validates all provided Supabase project references.
Cloudflare Pages invokes it as a `prebuild` check on the branch containing
this gate; ordinary local builds do not need deployment credentials.
The check intentionally fails the current mixed-project configuration and does
not print API keys. It does not itself change live Cloudflare environment vars.

## Required before one-project completion

1. Export and reconcile all nonduplicated old-project records and their source
   digests. Keep private staging and financial source ownership distinct.
2. Restore verified owner identity links and user sign-in, without copying
   password hashes or assuming equal UUIDs across projects.
3. Port mail schemas and Edge Functions to the destination, including complete
   security/grants/route verification. Check real inbound, internal inbox, and
   send permission against owner auth.
4. Port and verify other original backend functions and agent execution,
   without activating unconsented delegations. Bring 59 original URL routes
   and Android/site appearance through actual acceptance tests.
5. Reconcile PayPal transactions, donation ledger and withdrawal authorization
   against provider-backed evidence; no unverified payout activation.
6. When the destination passes role/behavior/record-count/hash/rollback tests,
   align **all** Pages/Worker/Auth/JWKS bindings to the single target. Verify
   real login, campaign CRUD, media, email and mail; observe no old-project traffic.
7. Preserve recoverable backups, then retire and delete old Supabase project.
   Project deletion is not available in the connected Supabase tools in this
   session; use an authorized management workflow only after steps 1–6.

No DNS, payments, passwords, secrets, production Pages deployment, or old-project
records were changed by this consolidation slice. Issue #137 remains the gate.

## Focused verification

- **Database target:** Both private SQL migrations applied successfully; DB catalog query verified 3/3 queue, 4/4 business-mail and 5/5 outreach-mail tables have RLS enabled. SQL migration applied successfully to `ssibsfmtodgximseeqsv`; target query confirms 3 functions, 0 queued jobs, 0 control records, 0 log records, and no `ifund_ops` schema usage for `anon`, `authenticated`, or `service_role`; anonymous enqueue execution also denied.
- **Gate logic:** standalone Node 22.16 smoke-test reproduction passed **7/7** cases, including production's observed mixed-project fail-closed behavior, safe target configuration, secret suppression and URL rejection. The committed repository test file and complete Vite build have **not** yet run in CI for this branch. No protected Actions minutes used.
- **Release:** no deployment configuration was changed. When attached to a Pages production branch, the `prebuild` gate will deliberately stop a deployment with the old/new mixed Supabase endpoints until backend routing is safely consolidated.
