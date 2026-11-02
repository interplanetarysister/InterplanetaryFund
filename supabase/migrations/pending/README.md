# Pending migrations

Files here are **reviewed but not applied**. Nothing in this directory has been
run against a live database. `supabase/migrations/` holds what the committed
migration history is; this directory holds what still needs a decision.

## Apply order

Apply in filename order, after the three committed migrations in
`supabase/migrations/`. Each file is additive and idempotent.

| Order | File | Purpose |
|---|---|---|
| 1 | `20261102_ifund_blog_entry_ownership_fix.sql` | **Security fix (B20).** Requires an entry to be filed under a blog the actor owns. Independent of the member migration; either order works. |
| 2 | `20261102_ifund_member_schema_completion.sql` | Creates the five tables the client already queries, adds the `ifund_profiles` account-lifecycle columns, adds `ifund_current_account_is_active()`, and closes blocker B16. |
| 3 | `public_campaign_detail_001.sql` | Public read-only campaign detail RPC for `apps/web`. Targets the legacy project `tzehxfikoslihnclhxuz`; confirm the target before applying. |
| — | `20261101_ifund_legal_acceptance_and_follows.sql` | **Superseded by order 2.** Its `ifund_follows` table is redefined there without the hard-coded `terms_version` dependency and without assuming `ifund_notifications` already exists. Retire this file rather than applying both. |

## How these are verified

`tests/pending-migration-order.test.js` (6 tests) verifies the claim that the two
pending migrations are independent: it applies them in both orders and checks
that each security effect survives either one.

Two further suites apply the committed migrations and then the pending ones to
**PGlite**, which is PostgreSQL 16 compiled to WebAssembly, and assert behavior
rather than text.

`tests/blog-entry-ownership.test.js` (8 tests) pins blocker B20: it reproduces
the vulnerability without the fix, then proves the fix blocks a non-owner while
leaving a legitimate owner able to create, publish, edit and delete.

`tests/account-lifecycle-write-gate.test.js` (10 tests) covers blocker B16,
including the publish-by-update bypass that the first version of the fix missed.

`tests/member-schema-migration.test.js` (11 tests) exercises the result with
three accounts: an active member, a second active member, and a suspended
member. It asserts:

- every `ifund_*` table the client queries exists after the migration;
- a suspended account cannot post or create a campaign, and an active one can;
- follows need an active account and a published campaign, and stay private;
- consent is recorded only for the acting member and never as `false`;
- notifications and inbox items are owner-scoped and cannot be authored by a
  browser;
- official publications are readable only once finalized;
- the migration is idempotent.

Run it with:

```
npm test
```

PGlite is a dev dependency, so this runs in CI on any pull request to `main`.

### What PGlite does not prove

PGlite is a real Postgres engine, so it proves SQL syntax, constraints,
triggers, RLS evaluation and column privileges. It does **not** prove:

- the hosted project's own configuration, extensions, or `auth` schema;
- PostgREST's translation of HTTP requests into the role and JWT claims that
  RLS sees;
- that the live database's existing rows satisfy the new constraints.

Those require an actual connection to `ssibsfmtodgximseeqsv`, which this
environment does not have. Treat a green suite as evidence about the SQL, and
run a staging apply plus the two-account checks against the real project before
production.

## Conventions

- Additive only. Never drop or retype a column that may hold existing data.
- `ifund_profiles.account_status` defaults to `pending`, never `active`. An
  account gains member access only through verified reconciliation.
- Server-owned columns (timestamps, ids, approval flags, account status) are
  never granted to `anon` or `authenticated`.
- Every new table gets RLS, an explicit `revoke all ... from public, anon,
  authenticated`, and then column-level grants.
- Policies are written as `drop policy if exists ... ; create policy ...` so a
  re-run is safe.
