CREATE INDEX IF NOT EXISTS ifund_inbox_items_campaign_idx
ON public.ifund_inbox_items (campaign_id)
WHERE campaign_id IS NOT NULL;