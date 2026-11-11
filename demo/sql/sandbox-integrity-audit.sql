-- Read-only sandbox integrity audit. Canonical demo tables only.
-- Run using an authorized Supabase SQL connection; never expose raw payment identifiers publicly.
-- Pass criteria: anomalous_orders=0; orphan_captures=0; orphan_receipts=0;
-- orphan_ledger_groups=0; duplicate_ledger_groups=0; captured cents match provider capture cents.
WITH audit AS (
 SELECT o.id,o.status,o.purpose,o.campaign_id,o.amount_cents,o.currency,o.paypal_capture_id,
        c.capture_id AS cap_id,c.amount_cents AS captured_cents,c.currency AS captured_currency,c.provider_status,
        (SELECT count(*) FROM public.ifund_demo_receipts r WHERE r.capture_id=o.paypal_capture_id) AS receipt_n,
        (SELECT count(*) FROM public.ifund_demo_ledger l WHERE l.capture_id=o.paypal_capture_id) AS ledger_n,
        (SELECT coalesce(sum(l.amount_cents),0) FROM public.ifund_demo_ledger l WHERE l.capture_id=o.paypal_capture_id) AS ledger_net,
        (SELECT count(*) FROM public.ifund_demo_events e WHERE e.order_id=o.id) AS event_n
 FROM public.ifund_demo_orders o LEFT JOIN public.ifund_demo_captures c ON c.order_id=o.id
), violations AS (
 SELECT id, array_remove(ARRAY[
   CASE WHEN status='captured' AND (cap_id IS NULL OR provider_status<>'COMPLETED' OR amount_cents IS DISTINCT FROM captured_cents OR currency IS DISTINCT FROM captured_currency OR paypal_capture_id IS DISTINCT FROM cap_id) THEN 'capture_mismatch' END,
   CASE WHEN status='captured' AND receipt_n<>1 THEN 'receipt_count' END,
   CASE WHEN status='captured' AND (ledger_n<>2 OR ledger_net<>0) THEN 'ledger_group' END,
   CASE WHEN status<>'captured' AND (cap_id IS NOT NULL OR receipt_n>0 OR ledger_n>0) THEN 'premature_finance' END,
   CASE WHEN purpose='campaign' AND campaign_id IS NULL THEN 'campaign_unattributed' END,
   CASE WHEN purpose='platform_support' AND campaign_id IS NOT NULL THEN 'platform_misattributed' END
 ],NULL) AS reasons FROM audit
)
SELECT
 now() AS inspected_at,
 (SELECT count(*) FROM public.ifund_demo_campaigns) AS campaigns,
 (SELECT count(*) FROM public.ifund_demo_campaigns WHERE image_path IS NULL OR btrim(image_path)='') AS images_missing,
 (SELECT count(*) FROM public.ifund_demo_orders WHERE status='captured') AS captured_orders,
 (SELECT coalesce(sum(amount_cents),0) FROM public.ifund_demo_orders WHERE status='captured') AS captured_cents,
 (SELECT coalesce(sum(amount_cents),0) FROM public.ifund_demo_captures WHERE provider_status='COMPLETED') AS provider_recorded_cents,
 (SELECT count(*) FROM public.ifund_demo_receipts) AS receipts,
 (SELECT count(*) FROM public.ifund_demo_events) AS webhook_events,
 (SELECT count(*) FROM public.ifund_demo_ledger) AS ledger_lines,
 (SELECT count(*) FROM violations WHERE cardinality(reasons)>0) AS anomalous_orders,
 (SELECT count(*) FROM public.ifund_demo_captures c LEFT JOIN public.ifund_demo_orders o ON o.id=c.order_id WHERE o.id IS NULL) AS orphan_captures,
 (SELECT count(*) FROM public.ifund_demo_receipts r LEFT JOIN public.ifund_demo_captures c ON c.capture_id=r.capture_id WHERE c.capture_id IS NULL) AS orphan_receipts,
 (SELECT count(*) FROM (SELECT l.capture_id FROM public.ifund_demo_ledger l LEFT JOIN public.ifund_demo_captures c ON c.capture_id=l.capture_id WHERE c.capture_id IS NULL GROUP BY l.capture_id) q) AS orphan_ledger_groups,
 (SELECT count(*) FROM (SELECT capture_id FROM public.ifund_demo_ledger GROUP BY capture_id HAVING count(*)<>2 OR sum(amount_cents)<>0) q) AS malformed_ledger_groups,
 (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'reasons',reasons)) FILTER(WHERE cardinality(reasons)>0),'[]'::jsonb) FROM violations) AS anomalies;
