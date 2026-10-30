# Account lifecycle enforcement — 2026-10-30

Applied migration: `20261030180529_ifund_account_lifecycle_guard_20261030`.


The authoritative Base44 `assertActiveAccount` guard blocks missing/deleted records, deletion-pending accounts, and every non-active account status.

The independent target adds server-controlled `ifund_profiles.account_status` (default `active`) and `account_deletion_pending` (default `false`). Authenticated Worker routes re-read both values on each request using the caller's JWT and the existing owner-only RLS policy. Browser roles cannot insert or update these fields; trusted server role can update them. Device-token resource requests recheck lifecycle state before returning data.

The source staging schema contains 10 User records, zero verified `owner_auth_uid` mappings, and no deletion-pending or non-active users. No legacy identities are attached to target Auth accounts. New target profiles default active; historical identity reconciliation remains a separate gate.

Contract tests cover active, disabled, anonymized, suspended, deletion-pending, missing-profile, malformed-state, and upstream-failure cases. The latest CI run passed 114 Worker tests, 140 web tests, and Vite compilation. Live authenticated browser and real RLS-session tests remain separate requirements.
