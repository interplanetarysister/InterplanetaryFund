-- Private Base44-compatible campaign setup state. Canonical records stay in Supabase.
-- Safe additive migration: public campaign columns, donation tables and ownership remain untouched.
create table if not exists public.ifund_campaign_creation_state (
  campaign_id uuid primary key references public.ifund_campaigns(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  draft_step smallint not null default 0 check (draft_step between 0 and 3),
  end_date date,
  location text not null default '' check (length(location) <= 160),
  location_lat double precision check (location_lat between -90 and 90),
  location_lng double precision check (location_lng between -180 and 180),
  cover_image_is_ai boolean not null default false,
  ai_profile jsonb not null default '{}'::jsonb check (jsonb_typeof(ai_profile) = 'object' and octet_length(ai_profile::text) <= 8192),
  story_versions jsonb not null default '[]'::jsonb check (jsonb_typeof(story_versions) = 'array' and octet_length(story_versions::text) <= 200000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ifund_campaign_creation_state_owner_idx on public.ifund_campaign_creation_state(owner_id);
alter table public.ifund_campaign_creation_state enable row level security;
revoke all on public.ifund_campaign_creation_state from public, anon;
grant select, insert, update on public.ifund_campaign_creation_state to authenticated;

drop policy if exists ifund_campaign_creation_state_owner_read on public.ifund_campaign_creation_state;
create policy ifund_campaign_creation_state_owner_read on public.ifund_campaign_creation_state
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    and (select public.ifund_current_account_is_active())
    and exists (select 1 from public.ifund_campaigns c where c.id = campaign_id and c.owner_id = (select auth.uid()))
  );

drop policy if exists ifund_campaign_creation_state_owner_insert on public.ifund_campaign_creation_state;
create policy ifund_campaign_creation_state_owner_insert on public.ifund_campaign_creation_state
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (select public.ifund_current_account_is_active())
    and (select public.ifund_current_user_has_current_terms())
    and exists (select 1 from public.ifund_campaigns c where c.id = campaign_id and c.owner_id = (select auth.uid()))
  );

drop policy if exists ifund_campaign_creation_state_owner_update on public.ifund_campaign_creation_state;
create policy ifund_campaign_creation_state_owner_update on public.ifund_campaign_creation_state
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    and (select public.ifund_current_account_is_active())
    and (select public.ifund_current_user_has_current_terms())
    and exists (select 1 from public.ifund_campaigns c where c.id = campaign_id and c.owner_id = (select auth.uid()))
  )
  with check (
    owner_id = (select auth.uid())
    and (select public.ifund_current_account_is_active())
    and (select public.ifund_current_user_has_current_terms())
    and exists (select 1 from public.ifund_campaigns c where c.id = campaign_id and c.owner_id = (select auth.uid()))
  );
