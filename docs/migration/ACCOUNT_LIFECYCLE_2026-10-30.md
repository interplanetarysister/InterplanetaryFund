# Account lifecycle enforcement — 2026-10-30

The authoritative Base44 `assertActiveAccount` guard blocks missing/deleted records, deletion-pending accounts, and every non-active account status.

## Target behavior

- `ifund_profiles.account_status` and `account_deletion_pending` are server-controlled, nullable lifecycle fields. The first applied migration incorrectly added active/false defaults. Corrective migration `20261030183040_ifund_account_lifecycle_reconcile_guard` has now removed those defaults and reset all profiles created before 2026-10-30 18:05:29 UTC to NULL; later trusted signups are preserved.
- NULL is deliberately **unverified**, not active. Existing target profiles are not backfilled because the source staging data has zero verified `owner_auth_uid` mappings. No old Base44 status is assigned to a target Auth user without an explicit identity match.
- New target Auth signups receive `account_status='active'` and `account_deletion_pending=false` only through the trusted `auth.users` profile trigger. The Worker still independently requires provider-confirmed email.
- Authenticated Worker routes re-read lifecycle fields on every request using the caller's verified JWT. Deletion-pending and every non-active state return 403; unmapped NULL lifecycle state returns a migration-specific 403; missing or malformed lifecycle data fails closed.
- The `ifund_current_account_is_active()` SECURITY INVOKER RLS predicate blocks authenticated direct PostgREST reads/writes when the current profile is not explicitly active. It queries only the caller's own profile through the existing owner-only SELECT policy; anonymous visitors retain public read access.
- Browser roles cannot INSERT or UPDATE lifecycle columns. The trusted `service_role` can update them. The Auth trigger function is executable only by `supabase_auth_admin` (and its owner).

## Existing accounts and rollout

Existing target profiles remain NULL until a verified source-to-Auth identity mapping and account-status reconciliation is completed. This is intentionally fail-closed and may block existing users from authenticated features until that reconciliation is performed. Do not solve this by blanket-setting all existing profiles active.

The corrective migration is recorded at `supabase/migrations/20261030183040_ifund_account_lifecycle_reconcile_guard.sql`. Rollback-only two-account RLS tests passed before apply: an active identity could read only its own profile, create/read its own legal acceptance, and read a public campaign; an unmapped identity could read only its own profile and could not see the other profile, campaign, or consent; anonymous visitors retained public campaign access; browser roles could not update lifecycle columns. All temporary test rows were rolled back. The three pre-existing profiles are now NULL/unverified. One draft campaign remains stored under an unmapped profile and is hidden until ownership is verified.

Live Auth, browser, and production deployment verification remain separate release gates.


Live Auth, browser, and production deployment verification remain separate release gates.
