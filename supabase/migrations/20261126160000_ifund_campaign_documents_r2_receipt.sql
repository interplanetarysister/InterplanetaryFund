-- Campaign documents use the same R2 receipt model as member media (PR #389):
-- worker/media/privateDocuments.js inserts object_store, object_etag,
-- object_sha256 and object_verified_at on upload, and
-- apps/web/src/api/campaignDocuments.js selects them on list and requires
-- object_sha256 for the download integrity check. The R2 migration
-- (20261126064000) added those columns to ifund_member_media only, so the
-- campaign-documents table lacked them: the upload insert and the list
-- select both fail against the migrated schema (caught by
-- tests/client-schema-contract.test.js).
--
-- Nullable on purpose: rows created before R2 receipts have no receipt to
-- backfill, and a NOT NULL column without a default would reject the
-- table's existing rows. New R2 uploads always supply all four values.
alter table public.ifund_campaign_documents
  add column if not exists object_store text check (object_store = 'r2'),
  add column if not exists object_etag text check (length(object_etag) between 1 and 200),
  add column if not exists object_sha256 text check (object_sha256 ~ '^[a-f0-9]{64}$'),
  add column if not exists object_verified_at timestamptz;
