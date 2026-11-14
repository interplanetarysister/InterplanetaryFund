-- Read-only campaign reconciliation. Execute only with authorized server-side SQL access.
-- Never expose source IDs, raw payloads, owner emails, or financial amounts to browser clients.
-- No data modifications, owner reassignment, or publishing occur in this script.

BEGIN TRANSACTION READ ONLY;

-- Aggregate coverage; note that a linked auth UID alone does not prove owner consent.
SELECT
  (SELECT count(*) FROM ifund_stage.campaign) AS staged_campaigns,
  (SELECT count(*) FROM ifund_transfer.campaign_snapshots) AS snapshots,
  (SELECT count(*) FROM public.ifund_campaigns) AS destination_campaigns,
  (SELECT count(*) FROM ifund_stage.campaign s JOIN auth.users u ON u.id = s.owner_auth_uid) AS linked_auth_campaigns,
  (SELECT count(*) FROM ifund_transfer.owner_identity_map WHERE verification_state = 'verified' AND destination_auth_uid IS NOT NULL) AS verified_owner_mappings;

-- Show batch discrepancies without exposing legacy identifiers.
SELECT entity_type, source_count, imported_count, status,
       (source_digest IS NOT NULL) AS has_source_digest
FROM ifund_transfer.source_import_batches
ORDER BY entity_type;

-- Detect duplicate source keys and unmatched snapshot records, aggregated only.
SELECT
  (SELECT count(*) - count(DISTINCT legacy_id) FROM ifund_stage.campaign) AS duplicate_staged_legacy_ids,
  (SELECT count(*) FROM ifund_stage.campaign s
    WHERE NOT EXISTS (SELECT 1 FROM ifund_transfer.campaign_snapshots p WHERE p.source_id = s.legacy_id)) AS staged_without_snapshot,
  (SELECT count(*) FROM ifund_transfer.campaign_snapshots p
    WHERE NOT EXISTS (SELECT 1 FROM ifund_stage.campaign s WHERE s.legacy_id = p.source_id)) AS snapshots_without_staged;

-- Count only mappings with both explicit verified state and matching destination UID.
SELECT count(*) AS campaigns_with_verified_destination_owner
FROM ifund_stage.campaign s
JOIN ifund_transfer.owner_identity_map m ON m.destination_auth_uid = s.owner_auth_uid
JOIN auth.users u ON u.id = m.destination_auth_uid
JOIN public.ifund_profiles p ON p.id = u.id
WHERE m.verification_state = 'verified'
  AND p.account_status = 'active'
  AND p.account_deletion_pending IS FALSE
  AND p.lifecycle_provenance IS NOT NULL;

COMMIT;
