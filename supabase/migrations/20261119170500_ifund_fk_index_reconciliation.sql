-- iFund 2026-11-19: additive FK index reconciliation from production performance advisor.
-- SOURCE ONLY. Apply only after disposable-PostgreSQL test and release authorization.
-- No RLS, auth grants, finances, Storage buckets, data or existing indexes modified.
-- Idempotent with prior deployment of independent indexes (names intentionally unique).
CREATE INDEX IF NOT EXISTS ifund_fkqa_agent_team_events_campaign_id_idx ON public.ifund_agent_team_events (campaign_id);
CREATE INDEX IF NOT EXISTS ifund_fkqa_agent_team_events_corrected_by_idx ON public.ifund_agent_team_events (corrected_by);
CREATE INDEX IF NOT EXISTS ifund_fkqa_echo_inapp_deliveries_campaign_id_idx ON public.ifund_echo_inapp_deliveries (campaign_id);
CREATE INDEX IF NOT EXISTS ifund_fkqa_editorial_agent_reviews_campaign_id_idx ON public.ifund_editorial_agent_reviews (campaign_id);
CREATE INDEX IF NOT EXISTS ifund_fkqa_event_items_event_id_owner_i_idx ON public.ifund_event_items (event_id, owner_id);
CREATE INDEX IF NOT EXISTS ifund_fkqa_event_items_owner_id_idx ON public.ifund_event_items (owner_id);
CREATE INDEX IF NOT EXISTS ifund_fkqa_event_registrations_item_id_event_id_idx ON public.ifund_event_registrations (item_id, event_id);
CREATE INDEX IF NOT EXISTS ifund_fkqa_events_campaign_id_idx ON public.ifund_events (campaign_id);
CREATE INDEX IF NOT EXISTS ifund_fkqa_growth_experiments_campaign_id_idx ON public.ifund_growth_experiments (campaign_id);
CREATE INDEX IF NOT EXISTS ifund_fkqa_mobile_organizer_blocks_organizer_id_idx ON public.ifund_mobile_organizer_blocks (organizer_id);
CREATE INDEX IF NOT EXISTS ifund_fkqa_opportunity_watches_opportunity_id_idx ON public.ifund_opportunity_watches (opportunity_id);
CREATE INDEX IF NOT EXISTS ifund_fkqa_social_archive_likes_member_id_idx ON public.ifund_social_archive_likes (member_id);
CREATE INDEX IF NOT EXISTS ifund_fkqa_social_archive_reports_reporter_id_idx ON public.ifund_social_archive_reports (reporter_id);
CREATE INDEX IF NOT EXISTS ifund_fkqa_social_archive_reports_reviewed_by_idx ON public.ifund_social_archive_reports (reviewed_by);
CREATE INDEX IF NOT EXISTS ifund_fkqa_social_likes_member_id_idx ON public.ifund_social_likes (member_id);
CREATE INDEX IF NOT EXISTS ifund_fkqa_social_reports_reporter_id_idx ON public.ifund_social_reports (reporter_id);
CREATE INDEX IF NOT EXISTS ifund_fkqa_social_reports_reviewed_by_idx ON public.ifund_social_reports (reviewed_by);
CREATE INDEX IF NOT EXISTS ifund_fkqa_support_replies_author_id_idx ON public.ifund_support_replies (author_id);
