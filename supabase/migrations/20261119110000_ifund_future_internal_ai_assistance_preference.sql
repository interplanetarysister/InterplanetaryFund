-- Optional default-on private AI drafting/analysis for NEW, verified account signups only.
-- Existing members are not enrolled by a backfill or treated as having consented.
-- High-impact activities always require separate, capability-specific authorization.
begin;
alter table public.ifund_ai_permission_preferences
  add column if not exists allow_future_internal_ai_assistance boolean not null default false;
comment on column public.ifund_ai_permission_preferences.allow_future_internal_ai_assistance is
  'Allows low-risk internal AI drafting, analysis and recommendations for the owner; does not authorize external services, publishing, messages, access to others data, payments or future high-impact features. New signups may select this explicitly disclosed default, and owners can revoke.';
commit;
