import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const evidence = JSON.parse(readFileSync(new URL("../docs/migration/contracts/data-migration-checkpoint.json", import.meta.url), "utf8"));

test("canonical runtime and legacy staging projects are not conflated", () => {
  assert.equal(evidence.schema_version, 2);
  assert.equal(evidence.canonical_supabase_project, "ssibsfmtodgximseeqsv");
  assert.equal(evidence.legacy_migration_staging_project, "tzehxfikoslihnclhxuz");
  assert.notEqual(evidence.canonical_supabase_project, evidence.legacy_migration_staging_project);
  assert.equal(evidence.canonical_runtime_aggregate.public_campaigns, 0);
  assert.equal(evidence.legacy_read_only_staging_aggregate.campaign_shadow_rows, 27);
});

test("email identity-map status is not treated as owner consent or cutover approval", () => {
  assert.equal(evidence.legacy_read_only_staging_aggregate.campaign_shadow_rows_joining_verified_destination_uid, 20);
  assert.equal(evidence.legacy_read_only_staging_aggregate.campaign_shadow_rows_without_verified_destination_uid, 7);
  assert.equal(evidence.owner_link_evidence.verified_map_state_is_not_owner_consent, true);
  assert.equal(evidence.owner_link_evidence.explicit_consent_receipt_table_present, false);
  assert.equal(evidence.owner_link_evidence.consented_campaign_owners_verified, 0);
  assert.equal(evidence.runtime_import.approved, false);
  assert.equal(evidence.runtime_import.performed, false);
  assert.equal(evidence.no_import_performed, true);
});

test("staging hash presence is not misreported as independent source reconciliation", () => {
  assert.equal(evidence.source_integrity.shadow_hash_fields_present, true);
  assert.equal(evidence.source_integrity.source_hashes_independently_recomputed, false);
  assert.equal(evidence.source_integrity.source_export_completeness_verified, false);
  assert.equal(evidence.source_integrity.source_ledger_integrity_verified, false);
});
