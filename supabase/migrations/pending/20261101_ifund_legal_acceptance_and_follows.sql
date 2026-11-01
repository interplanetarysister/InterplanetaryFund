-- Source-aligned non-financial migration: independent legal acceptance and campaign follows.
-- Canonical Supabase project ssibsfmtodgximseeqsv. Source FollowedCampaign
-- blob bf2f93902b087d6bce4fb0f4f03a541cb704ffbf and the existing
-- un-applied migration branch file 20261029_ifund_follow_notifications.sql.
-- This migration never creates or changes public.ifund_notifications and
-- never promotes historical Base44 rows. Keep payments/email deactivated.
-- Precondition: public.ifund_follows does not already exist; check before applying.
begin;
-- The legal-acceptance insert RLS policy already exists, but the client role
-- lacked INSERT privilege. Grant only the columns a member may provide;
-- the server sets accepted_at and enforces method and document paths.
grant insert (owner_id, terms_version, explicit_consent)
  on public.ifund_legal_acceptances to authenticated;


create table public.ifund_follows (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.ifund_campaigns(id) on delete cascade,
  pinned boolean not null default false,
  archived boolean not null default false,
  notification_prefs jsonb not null default '{"updates":true,"media":true,"milestones":true,"goal_reached":true,"nearing_completion":true,"comments":false,"volunteer":true,"events":true,"emergencies":true,"completed":true}'::jsonb,
  last_viewed timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, campaign_id),
  constraint ifund_follow_prefs_valid check (
    jsonb_typeof(notification_prefs) = 'object'
    and notification_prefs ?& array['updates','media','milestones','goal_reached','nearing_completion','comments','volunteer','events','emergencies','completed']
    and (notification_prefs - 'updates' - 'media' - 'milestones' - 'goal_reached' - 'nearing_completion' - 'comments' - 'volunteer' - 'events' - 'emergencies' - 'completed') = '{}'::jsonb
    and jsonb_typeof(notification_prefs->'updates') = 'boolean' and
      jsonb_typeof(notification_prefs->'media') = 'boolean' and
      jsonb_typeof(notification_prefs->'milestones') = 'boolean' and
      jsonb_typeof(notification_prefs->'goal_reached') = 'boolean' and
      jsonb_typeof(notification_prefs->'nearing_completion') = 'boolean' and
      jsonb_typeof(notification_prefs->'comments') = 'boolean' and
      jsonb_typeof(notification_prefs->'volunteer') = 'boolean' and
      jsonb_typeof(notification_prefs->'events') = 'boolean' and
      jsonb_typeof(notification_prefs->'emergencies') = 'boolean' and
      jsonb_typeof(notification_prefs->'completed') = 'boolean'
  )
);
create index ifund_follows_owner_created_idx
  on public.ifund_follows(owner_id,created_at desc);
create index ifund_follows_campaign_idx
  on public.ifund_follows(campaign_id);

alter table public.ifund_follows enable row level security;
revoke all on table public.ifund_follows from public, anon, authenticated;
grant select,insert,delete on public.ifund_follows to authenticated;
grant update(pinned,archived,notification_prefs,last_viewed)
  on public.ifund_follows to authenticated;

create policy ifund_follows_owner_select on public.ifund_follows
  for select to authenticated using (
    owner_id = (select auth.uid())
    and (select public.ifund_current_account_is_active())
    and exists (
      select 1 from public.ifund_legal_acceptances a
      where a.owner_id = (select auth.uid())
        and a.terms_version = '2026-10-13-v3'
        and a.explicit_consent = true
        and a.accepted_at is not null
    )
  );
create policy ifund_follows_owner_insert on public.ifund_follows
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and (select public.ifund_current_account_is_active())
    and exists (
      select 1 from public.ifund_legal_acceptances a
      where a.owner_id = (select auth.uid())
        and a.terms_version = '2026-10-13-v3'
        and a.explicit_consent = true
        and a.accepted_at is not null
    )
    and exists (
      select 1 from public.ifund_campaigns c
      where c.id=campaign_id and c.status='active'
    )
  );
create policy ifund_follows_owner_update on public.ifund_follows
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    and (select public.ifund_current_account_is_active())
    and exists (
      select 1 from public.ifund_legal_acceptances a
      where a.owner_id = (select auth.uid())
        and a.terms_version = '2026-10-13-v3'
        and a.explicit_consent = true
        and a.accepted_at is not null
    )
  )
  with check (
    owner_id = (select auth.uid())
    and (select public.ifund_current_account_is_active())
    and exists (
      select 1 from public.ifund_legal_acceptances a
      where a.owner_id = (select auth.uid())
        and a.terms_version = '2026-10-13-v3'
        and a.explicit_consent = true
        and a.accepted_at is not null
    )
  );
create policy ifund_follows_owner_delete on public.ifund_follows
  for delete to authenticated using (
    owner_id = (select auth.uid())
    and (select public.ifund_current_account_is_active())
    and exists (
      select 1 from public.ifund_legal_acceptances a
      where a.owner_id = (select auth.uid())
        and a.terms_version = '2026-10-13-v3'
        and a.explicit_consent = true
        and a.accepted_at is not null
    )
  );

-- public.ifund_notifications is already created by the canonical
-- 20261030170627 foundation migration. Its owner-scoped RLS is managed by
-- 20261030234921; do not duplicate or replace that table here.


comment on table public.ifund_follows is 'Owner-scoped campaign follows. No historical import or external publishing is activated.';

commit;
