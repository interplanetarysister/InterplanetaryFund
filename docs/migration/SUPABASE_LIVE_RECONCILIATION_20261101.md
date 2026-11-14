# Supabase live reconciliation checkpoint — 2026-11-01

This is a read-only audit, not a migration completion or cutover approval. Production project ref: `ssibsfmtodgximseeqsv`.

## Verified inventory
- 16 public tables, 79 private staged entity tables, 12 finance tables, 12 transfer tables, plus operations, integrations, controls, and mail schemas.
- Staged campaigns: 28. Owner Auth UID present and matching `auth.users`: 20. Remaining 8 require ownership resolution.
- Source campaign snapshots: 28, but zero marked `source_verified`.
- Identity mappings: 3 `verified`, 7 `awaiting_destination_login`.
- Historical staging contains 10 users, 33 blog entries, 96 notifications; public and staged row counts are not equivalent to completed verified imports.
- Finance ledger and workflow job/execution tables have no recorded activity in the inspected snapshot.

## Source-of-truth conflict
`docs/migration/STATUS.md` is a dated 2026-10-24 status record and must not be used as the current live state. `docs/migration/CONTINUATION_AUDIT_20261101.md` provides newer release and permission findings. Neither alone establishes production readiness.

## Release and data gates
1. Verify actual Cloudflare production source and commit; do not infer from project metadata.
2. Reconcile 28 staged campaigns against 27 imported batch rows and absent source digests.
3. Verify each source owner against the destination identity mapping and current account lifecycle. Do not auto-claim based on email or staged `owner_auth_uid` alone.
4. Compare candidate campaigns to existing public campaigns by legacy source ID and owner, not title alone; ensure idempotency.
5. Import only approved nonfinancial content, initially private and owner-visible. Preserve source provenance and avoid publishing based on legacy `active` status.
6. Do not copy historical `raised_amount` or `donor_count` into verified donation ledgers without provider evidence.
7. Check cross-account RLS, approved column grants, anonymous read projections, and scoped RPCs before exposure.
8. Run application integration tests, CI and live browser checks before cutover.

## Security review
Supabase advisor flags 26 RLS-enabled tables without policies (many private/server-only), six elevated function access findings, and disabled leaked-password protection. Review actual grants, function bodies, and intended access individually. Do not indiscriminately revoke the intentionally owner-scoped migration RPCs.

No production SQL, financial transactions, grants, DNS, Cloudflare deployment, or external publishing was changed in this checkpoint.

## Verified schema-level promotion blockers (follow-up)
The actual `ifund_transfer.campaign_snapshots` schema has explicit CHECK constraints `source_verified = false` and `financial_authoritative = false`. The `ifund_transfer.source_inventory` schema similarly constrains `source_export_verified = false`. These constraints mean historical snapshot rows are intentionally non-authoritative and cannot simply be toggled to verified. A reviewed, independent verification mechanism and migration design are required; do not drop these constraints to accelerate import.

`ifund_transfer.source_import_batches` contains source and imported counts plus a nullable source digest and status. Its historical campaign batch count of 27 must be reconciled against the 28 staged campaigns and 28 snapshots without assuming the additional record is legitimate or duplicate. No source IDs, emails, or raw payloads should be copied into public documentation.

The live schema read was successful, but direct SQL execution has been intermittently blocked by safety checks. Do not claim row-level reconciliation or an import based on table metadata alone.
