# Interplanetary Fund — database schema inventory

**Snapshot:** feature branch `feature/ifund-full-frontend-20261103`  
**Authority:** migration issue #137 and the migration files in this repository.  
**Status:** documentation snapshot only. No SQL is executed by publishing these files.

## Summary

The schema is **not a complete, production-validated replacement** for the legacy application database.

| Layer | Repository evidence | Status |
|---|---|---|
| Initial member/campaign/community/connection schema | `supabase/migrations/20261025011400_initial.sql` | Committed; destination-project parity and live RLS still require verification |
| Blog schema and access controls | Committed migration history | Committed; security remediation is separately pending |
| Base44 entity inventory | 76 referenced entities; 10 already represented; 66 generated tables | SQL and manifest exist, but generated migration is pending |
| Member completion schema | Five additional client-facing tables, profile lifecycle fields and account-active helper | Pending migration; not applied |
| Live data import | No authorized row-count reconciliation/export in this branch | Not validated |
| Full production parity | 184 backend function entrypoints, authorization and provider workflows | Not complete |

## Committed baseline

The initial migration creates the core tables:

- `public.ifund_profiles`
- `public.ifund_campaigns`
- `public.ifund_posts`
- `public.ifund_connections`

The committed migration history also contains the blog schema. These files establish a source-controlled baseline; they do not prove that the hosted Supabase project has identical grants, policies, extensions or data.

## Pending schema — do not treat as applied

The pending migration inventory is authoritative for apply order and caveats:

- `20261102_ifund_base44_entity_tables.sql`: generated storage for 66 of the 76 referenced legacy entities. It is deny-by-default (RLS enabled, no browser grants or policies).
- `20261102_ifund_member_schema_completion.sql`: creates `ifund_legal_acceptances`, `ifund_notifications`, `ifund_inbox_items`, `ifund_follows`, and `ifund_official_publications`; adds account-lifecycle fields and `ifund_current_account_is_active()`; closes the documented write-gate gap.
- `20261102_ifund_blog_entry_ownership_fix.sql`: fixes blog-entry ownership checks.
- Additional pending public-read/RPC fixes are documented in `supabase/migrations/pending/README.md` and `docs/migration/BLOCKERS.md`.

The pending README explicitly states these files have not been applied to a live database. Some pending changes alter access behavior; apply only after the documented staging review and cross-account tests.

## Entity inventory evidence

The committed machine-readable manifest is `docs/migration/base44-entity-tables.json`. The associated generator and pending SQL report:

- 76 referenced entities
- 10 entities already had a table
- 66 additional tables generated
- 736 declared columns
- 97 enum check constraints

The generated tables use original text identifiers and are deny-by-default. The manifest is the authoritative column inventory; this page intentionally does not duplicate hundreds of column names.

## Required before production schema certification

1. Reconcile every committed and pending migration against the actual destination project.
2. Apply pending migrations only through an approved, reviewed sequence in a non-production validation environment first.
3. Verify RLS, grants, constraints, triggers, RPCs and extensions against at least two distinct authenticated accounts.
4. Reconcile legacy data and media with source/target row counts and ownership mapping.
5. Resolve the production dependencies and open blockers in `docs/migration/BLOCKERS.md`.
6. Record the exact migration commit and live database verification evidence.

**Never put Supabase service-role/secret keys, database passwords, OAuth secrets or other credentials in these public assets.**
