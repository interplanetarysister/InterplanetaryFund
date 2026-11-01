-- Explicit deny policies retain service-role-only access and suppress
-- advisory information notices for private non-Data-API staging tables.
CREATE POLICY deny_clients_campaign_snapshots ON ifund_transfer.campaign_snapshots
 FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY deny_clients_content_snapshots ON ifund_transfer.content_snapshots
 FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY deny_clients_source_inventory ON ifund_transfer.source_inventory
 FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);