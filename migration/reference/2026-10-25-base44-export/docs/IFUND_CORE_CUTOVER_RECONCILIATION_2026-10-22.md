# Replacement services and cutover evidence

Supabase project tzehxfikoslihnclhxuz already had `ifund_migration.campaign_shadow` with 22 rows and `owner_identity_map` with five rows. Preserve these existing records; do not blindly reimport or change their authority.

Applied migration `ifund_core_private_migration_staging`: private source_records, import_batches, cutover_control, all RLS protected, no public or authenticated client privileges. This staging is not production authority.

Cutover control requires three verified conditions per service: destination parity, frozen source, reconciliation. All default false. Financial records and payouts remain on existing authoritative service until independently reconciled. Live workflow execution stays disabled. Avoid switching DNS or payments without final live tests.

Pending: authenticated replacement API, Supabase Auth ownership reconciliation, file storage and image migration, payment webhooks and immutable ledger, external connection authorization, agent runtime, source event cursors, live functional tests, verified source freeze and DNS route switch.

## Live source reconciliation (2026-10-22)

Using the connected Base44 entity API and Supabase database (not repo guesses):
Base44 Campaign count = 24, Supabase private campaign shadow count = 22.
Two campaign source IDs are missing from the shadow:
- `6ada6e37149d01f737621c6a`
- `6ad868ea63ed57d1177b5fd1`
No stale destination campaign IDs were found in this comparison.
Base44 also returned 32 PlatformConnection records, 10 User records,
0 Donation records and 0 Withdrawal records (single-page limit 500 each).
All five Supabase owner identity map rows remain `awaiting_destination_login`.
The missing campaigns cannot be promoted to production ownership without
source-owner mapping and verified destination authentication. Preserve source.
