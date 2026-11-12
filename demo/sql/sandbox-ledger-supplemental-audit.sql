-- Supplemental READ-ONLY demo ledger controls (2026-11-12).
-- Never interprets stored provider_status or webhook event_type as PayPal API/signature proof.
-- Expected: all anomaly_count values = 0. Requires authorized read-only SQL role.
-- No provider calls, writes, payouts, or synthetic records.
WITH checks AS (
 SELECT 'duplicate_order_provider_capture_id' AS check_name, count(*)::bigint AS anomaly_count
 FROM (SELECT paypal_capture_id FROM public.ifund_demo_orders WHERE paypal_capture_id IS NOT NULL GROUP BY paypal_capture_id HAVING count(*) > 1) d
 UNION ALL
 SELECT 'duplicate_capture_provider_id',count(*) FROM
 (SELECT capture_id FROM public.ifund_demo_captures GROUP BY capture_id HAVING count(*)>1) d
 UNION ALL
 SELECT 'duplicate_receipt_capture_id',count(*) FROM
 (SELECT capture_id FROM public.ifund_demo_receipts GROUP BY capture_id HAVING count(*)>1) d
 UNION ALL
 SELECT 'captured_missing_exact_opposing_entries',count(*) FROM (
 SELECT o.id
 FROM public.ifund_demo_orders o
 LEFT JOIN public.ifund_demo_ledger l ON l.capture_id=o.paypal_capture_id
 WHERE o.status='captured'
 GROUP BY o.id,o.amount_cents
 HAVING count(l.capture_id)<>2
 OR count(*) FILTER(WHERE l.amount_cents=o.amount_cents)<>1
 OR count(*) FILTER(WHERE l.amount_cents=-o.amount_cents)<>1
 ) d
 UNION ALL
 SELECT 'noncaptured_financial_entries',count(*) FROM public.ifund_demo_ledger l
 LEFT JOIN public.ifund_demo_orders o ON o.paypal_capture_id=l.capture_id
 WHERE o.id IS NULL OR o.status<>'captured'
 UNION ALL
 SELECT 'nonpositive_or_subcent_order',count(*) FROM public.ifund_demo_orders
 WHERE amount_cents<=0 OR currency IS NULL OR currency<>'USD'
 UNION ALL
 SELECT 'demo_order_ids_in_live_donations',count(*) FROM public.ifund_demo_orders o
 JOIN public.ifund_donations d ON d.paypal_order_id=o.id::text
 UNION ALL
 SELECT 'demo_capture_ids_in_live_donations',count(*) FROM public.ifund_demo_captures c
 JOIN public.ifund_donations d ON d.paypal_capture_id=c.capture_id
 UNION ALL
 SELECT 'demo_capture_ids_in_live_ledger',count(*) FROM public.ifund_demo_captures c
 JOIN public.ifund_ledger_entries l ON l.paypal_capture_id=c.capture_id
)
SELECT now() AS inspected_at,check_name,anomaly_count,
 CASE WHEN anomaly_count=0 THEN 'PASS_DB_ONLY' ELSE 'INVESTIGATE' END AS status
FROM checks ORDER BY check_name;
-- Important: column names of live financial tables must be checked against the
-- current schema before executing. These comparisons do not prove global isolation.
-- A real provider reconciliation separately requires PayPal sandbox GET order/capture,
-- signed webhook verification evidence, buyer authorization and owner/admin view checks.
