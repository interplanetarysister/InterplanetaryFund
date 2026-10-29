-- STAGED ONLY. Owner approval, two distinct logged-in test accounts,
-- RLS allow/deny tests, and a rollback plan required before applying.
-- Source: base44/entities/FollowedCampaign.jsonc and Notification.jsonc.
-- Does not change the preserved historical private staging schemas or ledger.
begin;

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
  for select to authenticated using (owner_id = (select auth.uid()));
create policy ifund_follows_owner_insert on public.ifund_follows
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.ifund_campaigns c
      where c.id=campaign_id and c.status='active'
    )
  );
create policy ifund_follows_owner_update on public.ifund_follows
  for update to authenticated using (owner_id=(select auth.uid()))
  with check (owner_id=(select auth.uid()));
create policy ifund_follows_owner_delete on public.ifund_follows
  for delete to authenticated using (owner_id=(select auth.uid()));

create table public.ifund_notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  body text check (char_length(body) <= 1200),
  type text not null default 'system'
    check (type in ('donation','update','thank_you','announcement','milestone','system')),
  link text check (
    link is null or (
      char_length(link) between 1 and 512
      and left(link,1)='/' and left(link,2)<>'//'
      and link !~ '[[:cntrl:]]' and position(chr(92) in link)=0
    )
  ),
  read boolean not null default false,
  source_event_id text,
  created_at timestamptz not null default now(),
  unique (owner_id,source_event_id)
);
create index ifund_notifications_owner_created_idx
  on public.ifund_notifications(owner_id,created_at desc);

alter table public.ifund_notifications enable row level security;
revoke all on table public.ifund_notifications from public,anon,authenticated;
grant select on public.ifund_notifications to authenticated;
grant update(read) on public.ifund_notifications to authenticated;
-- No authenticated INSERT or DELETE; only verified backend producers may
-- create notices. No donation/settlement/PayPal notification is synthesized.
create policy ifund_notifications_owner_select on public.ifund_notifications
  for select to authenticated using (owner_id=(select auth.uid()));
create policy ifund_notifications_owner_ack on public.ifund_notifications
  for update to authenticated using (owner_id=(select auth.uid()))
  with check (owner_id=(select auth.uid()));

commit;

-- Rollback (only before genuine records exist):
-- begin; drop table public.ifund_notifications; drop table public.ifund_follows; commit;
-- On populated installations perform a reviewed reversible migration instead.
