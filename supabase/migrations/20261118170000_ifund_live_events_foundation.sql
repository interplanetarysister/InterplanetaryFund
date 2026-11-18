-- IFund Live event scheduling foundation; NOT a live video transport.
-- Keep in source until independently tested and explicitly authorized for apply.
-- Creators cannot set provider-confirmed live state via the public Data API.
create table if not exists public.ifund_live_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  campaign_id uuid references public.ifund_campaigns(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 8 and 140),
  description text not null default '' check (char_length(description) <= 2000),
  scheduled_at timestamptz,
  status text not null default 'draft' check (status in ('draft','scheduled','live','ended','cancelled')),
  public_visible boolean not null default false,
  recording_consent boolean not null default false,
  provider_status text not null default 'unconfigured' check (provider_status in ('unconfigured','verified','ended','error')),
  verified_live_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ifund_live_schedule_required check (status not in ('scheduled','live') or scheduled_at is not null),
  constraint ifund_live_provider_truth check (
    status not in ('live','ended') or
    (provider_status in ('verified','ended') and verified_live_at is not null)
  )
);
create index if not exists ifund_live_events_public_schedule_idx
  on public.ifund_live_events (scheduled_at desc)
  where public_visible and status in ('scheduled','live','ended');
create index if not exists ifund_live_events_owner_idx on public.ifund_live_events (owner_id, created_at desc);
alter table public.ifund_live_events enable row level security;

revoke all on public.ifund_live_events from public, anon, authenticated;
grant select on public.ifund_live_events to anon;
grant select, insert, update on public.ifund_live_events to authenticated;
-- No member DELETE: cancel or retain event history, including verified streams.
drop policy if exists ifund_live_events_read on public.ifund_live_events;
create policy ifund_live_events_read on public.ifund_live_events
  for select to anon,authenticated
  using (
    (public_visible and status in ('scheduled','live','ended')
      and (status <> 'live' or (provider_status='verified' and verified_live_at is not null)))
    or
    (owner_id = (select auth.uid()) and (select public.ifund_current_account_is_active()))
  );
drop policy if exists ifund_live_events_create on public.ifund_live_events;
create policy ifund_live_events_create on public.ifund_live_events
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (select public.ifund_current_account_is_active())
    and coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false) = false
    and (select u.email_confirmed_at from auth.users u where u.id=(select auth.uid())) is not null
    and status='draft' and public_visible=false
    and provider_status='unconfigured' and verified_live_at is null and ended_at is null
    and (campaign_id is null or exists (
      select 1 from public.ifund_campaigns c
       where c.id=campaign_id and c.owner_id=(select auth.uid()) and c.status='active'
    ))
  );
drop policy if exists ifund_live_events_edit on public.ifund_live_events;
create policy ifund_live_events_edit on public.ifund_live_events
  for update to authenticated
  using (
    owner_id=(select auth.uid())
    and (select public.ifund_current_account_is_active())
    and status in ('draft','scheduled','cancelled')
    and provider_status='unconfigured' and verified_live_at is null
  )
  with check (
    owner_id=(select auth.uid())
    and (select public.ifund_current_account_is_active())
    and coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false) = false
    and status in ('draft','scheduled','cancelled')
    and provider_status='unconfigured' and verified_live_at is null and ended_at is null
    and (campaign_id is null or exists (
      select 1 from public.ifund_campaigns c
       where c.id=campaign_id and c.owner_id=(select auth.uid()) and c.status='active'
    ))
  );
-- Keep provider states service-only, but RLS does not prevent setting an
-- invalid future transition by a privileged backend: provider gateway must
-- verify signed lifecycle event + owner/campaign association before updating.
comment on table public.ifund_live_events is
  'Creator-scoped IFund Live event schedule; live status requires server-confirmed provider session. No streaming keys or private tokens.';
