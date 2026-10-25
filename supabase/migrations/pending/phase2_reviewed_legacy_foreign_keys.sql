-- PENDING PHASE 2 ONLY. No SQL applied to any Supabase project.
-- Referential links whose meanings were confirmed by their source entity names.
-- Requires all 95 phase2 staging table definitions to exist first.
-- Legacy source IDs remain text, preserving Base44 identity while auth mapping is pending.
ALTER TABLE ifund_finance."donation"
  ADD CONSTRAINT ifund_donation_campaign_source_fk FOREIGN KEY ("campaign_id")
  REFERENCES ifund_stage."campaign"(legacy_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE ifund_finance."withdrawal"
  ADD CONSTRAINT ifund_withdrawal_campaign_source_fk FOREIGN KEY ("campaign_id")
  REFERENCES ifund_stage."campaign"(legacy_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE ifund_finance."holding_ledger_entry"
  ADD CONSTRAINT ifund_holding_campaign_source_fk FOREIGN KEY ("campaign_id")
  REFERENCES ifund_stage."campaign"(legacy_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE ifund_finance."financial_operation"
  ADD CONSTRAINT ifund_operation_campaign_source_fk FOREIGN KEY ("campaign_id")
  REFERENCES ifund_stage."campaign"(legacy_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE ifund_stage."campaign_update"
  ADD CONSTRAINT ifund_update_campaign_source_fk FOREIGN KEY ("campaign_id")
  REFERENCES ifund_stage."campaign"(legacy_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE ifund_stage."community_member"
  ADD CONSTRAINT ifund_member_community_source_fk FOREIGN KEY ("community_id")
  REFERENCES ifund_stage."community"(legacy_id) DEFERRABLE INITIALLY DEFERRED;
-- Additional relation mappings and reconciliation against actual export are REQUIRED.
-- Historical Base44 records may contain unresolved source IDs; reconcile before activation.
