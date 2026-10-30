# Account lifecycle enforcement — 2026-10-30

The authoritative Base44 `assertActiveAccount` guard blocks missing/deleted records, deletion-pending accounts, and every non-active account status.

## Target behavior

- `ifund_profiles.account_status` and `account_deletion_pending` are server-controlled, nullable lifecycle fields.
- NULL is deliberately **unverified**, not active. Existing target profiles are not backfilled because the source staging data has zero verified `owner_auth_uid` mappings. No old Base44 status is assigned to a target Auth user without an explicit identity match.
- New target Auth signups receive `account_status='active'` and `account_deletion_pending=false` only through the trusted `auth.users` profile trigger. The Worker still independently requires provider-confirmed email.
- Authenticated Worker routes re-read lifecycle fields on every request using the caller's verified JWT. Deletion-pending and every non-active state return 403; unmapped NULL lifecycle state returns a migration-specific 403; missing or malformed lifecycle data fails closed.
- The `ifund_current_account_is_active()` SECURITY DEFINER RLS predicate blocks authenticated direct PostgREST reads/writes when the current profile is not explicitly active. Anonymous visitors retain public read access. The owner-only profile SELECT policy remains ungated so the Worker can inspect the private lifecycle fields.
- Browser roles cannot INSERT or UPDATE lifecycle columns. The trusted `service_role` can update them. The Auth trigger function is executable only by `supabase_auth_admin` (and its owner).

## Existing accounts and rollout

Existing target profiles remain NULL until a verified source-to-Auth identity mapping and account-status reconciliation is completed. This is intentionally fail-closed and may block existing users from authenticated features until that reconciliation is performed. Do not solve this by blanket-setting all existing profiles active.

The migration remains in `supabase/migrations/pending/`. It has not been applied to the canonical project. Before applying it, run isolated two-account RLS tests proving:
1. an active account can read/write only its own permitted records;
2. disabled, deletion-pending, and unmapped accounts cannot use Worker or direct PostgREST paths;
3. anonymous public reads still work;
4. browser roles cannot alter lifecycle columns or call the Auth trigger function;
5. new signups receive active/false and existing rows remain NULL.

Live Auth, browser, and production deployment verification remain separate release gates.
