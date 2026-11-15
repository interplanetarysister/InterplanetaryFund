-- READ-ONLY provenance audit for staged subscription event migration.
-- Run with a privileged read-only transaction; never infer provider event time
-- from mutable intent summary timestamps without external reconciliation.
BEGIN READ ONLY;
SELECT
  count(*) FILTER (WHERE last_payment_at IS NOT NULL OR last_reversal_at IS NOT NULL)
    AS intents_with_summary_timestamps,
  count(*) FILTER (WHERE last_payment_at IS NOT NULL AND last_reversal_at IS NOT NULL)
    AS intents_with_both_summary_timestamps,
  count(*) FILTER (WHERE last_payment_at > now() OR last_reversal_at > now())
    AS intents_with_future_summary_timestamps
FROM public.ifund_subscription_intents;
SELECT
  count(*) AS ledger_rows,
  count(*) FILTER (WHERE provider_occurred_at IS NULL) AS missing_provider_event_time,
  count(*) FILTER (WHERE provider_resource_id IS NULL) AS missing_immutable_resource_id,
  count(*) FILTER (WHERE entry_type IN ('refund','reversal') AND provider_resource_id IS NULL)
    AS reversals_without_resource_id,
  count(*) FILTER (WHERE provider_occurred_at > now()) AS future_provider_event_time
FROM public.ifund_subscription_ledger;
-- Count only, no member or payment identifiers leave the database.
SELECT count(*) AS intents_with_ledger_time_disagreement
FROM public.ifund_subscription_intents i
WHERE (i.last_payment_at IS NOT NULL OR i.last_reversal_at IS NOT NULL)
  AND EXISTS (
    SELECT 1 FROM public.ifund_subscription_ledger l
    WHERE l.intent_id=i.id AND l.provider_occurred_at IS NOT NULL
      AND l.provider_occurred_at >
        greatest(coalesce(i.last_payment_at,'-infinity'::timestamptz),
                 coalesce(i.last_reversal_at,'-infinity'::timestamptz))
  );
ROLLBACK;
