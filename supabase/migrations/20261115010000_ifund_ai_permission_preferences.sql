-- Advance AI preferences are not provider OAuth grants or publishing authorization.
-- Scope-limited owner settings only. Future capabilities always need a fresh consent flow.
begin;
create table if not exists public.ifund_ai_permission_preferences (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  default_action text not null default 'ask' check (default_action in ('ask','draft','manual')),
  allow_ai_campaign_drafts boolean not null default false,
  allow_ai_outreach_drafts boolean not null default false,
  interested_in_future_automation boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.ifund_ai_permission_preferences enable row level security;
revoke all on public.ifund_ai_permission_preferences from anon, authenticated;
drop policy if exists ifund_ai_permissions_owner_read on public.ifund_ai_permission_preferences;
create policy ifund_ai_permissions_owner_read on public.ifund_ai_permission_preferences
  for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists ifund_ai_permissions_owner_insert on public.ifund_ai_permission_preferences;
create policy ifund_ai_permissions_owner_insert on public.ifund_ai_permission_preferences
  for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists ifund_ai_permissions_owner_update on public.ifund_ai_permission_preferences;
create policy ifund_ai_permissions_owner_update on public.ifund_ai_permission_preferences
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
grant select, insert, update on public.ifund_ai_permission_preferences to authenticated;
-- Do not create a broad consent for future unimplemented features.
-- Neither these settings nor an OAuth identity permit external posting, messaging,
-- financial activity or data transfer without a provider-specific verified grant.
commit;
