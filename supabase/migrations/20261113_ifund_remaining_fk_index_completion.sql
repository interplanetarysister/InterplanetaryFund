-- Covers 23 verified Supabase foreign-key index warnings.
-- No grants, row changes, or policy modifications.
create index if not exists idx_draft_meta_owner_id on ifund_communications_runtime.draft_meta (owner_id);
create index if not exists idx_permissions_provider on ifund_connections_runtime.permissions (provider);
create index if not exists idx_requests_connection_id on ifund_connections_runtime.requests (connection_id);
create index if not exists idx_requests_provider on ifund_connections_runtime.requests (provider);
create index if not exists idx_recommendation_order_owner_id on ifund_growth_runtime.recommendation_order (owner_id);
create index if not exists idx_workforce_assignments_implementation_id on ifund_ops.workforce_assignments (implementation_id);
create index if not exists idx_workforce_assignments_position_id on ifund_ops.workforce_assignments (position_id);
create index if not exists idx_preferences_campaign_id on ifund_story_runtime.preferences (campaign_id);
create index if not exists idx_suggestion_choices_campaign_id on ifund_story_runtime.suggestion_choices (campaign_id);
create index if not exists idx_suggestion_choices_canonical_draft_id on ifund_story_runtime.suggestion_choices (canonical_draft_id);
create index if not exists idx_suggestion_choices_suggestion_id on ifund_story_runtime.suggestion_choices (suggestion_id);
create index if not exists idx_recommendation_order_owner_id on ifund_strategy_runtime.recommendation_order (owner_id);
create index if not exists idx_ifund_campaign_translation_created_by_id on public.ifund_campaign_translation (created_by_id);
create index if not exists idx_ifund_campaign_update_created_by_id on public.ifund_campaign_update (created_by_id);
create index if not exists idx_ifund_demo_events_order_id on public.ifund_demo_events (order_id);
create index if not exists idx_ifund_demo_flags_updated_by on public.ifund_demo_flags (updated_by);
create index if not exists idx_ifund_demo_media_ai_run_id on public.ifund_demo_media (ai_run_id);
create index if not exists idx_ifund_demo_tracker_updated_by on public.ifund_demo_tracker (updated_by);
create index if not exists idx_ifund_oauth_transactions_owner_id on public.ifund_oauth_transactions (owner_id);
create index if not exists idx_ifund_paypal_sandbox_orders_campaign_id on public.ifund_paypal_sandbox_orders (campaign_id);
create index if not exists idx_ifund_studio_page_versions_changed_by on public.ifund_studio_page_versions (changed_by);
create index if not exists idx_ifund_studio_pages_created_by on public.ifund_studio_pages (created_by);
create index if not exists idx_ifund_studio_pages_updated_by on public.ifund_studio_pages (updated_by);
