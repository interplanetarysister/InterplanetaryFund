-- Durable, owner-only in-app reminders. No email, push, social or financial operations.
-- All writes go through verified-member RPCs; cron is the sole dispatch executor.
create table if not exists public.ifund_inapp_reminder_queue (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 4 and 100),
  body text not null check (char_length(body) between 8 and 1000),
  due_at timestamptz not null,
  next_attempt_at timestamptz not null,
  status text not null default 'queued' check (status in ('queued','delivered','cancelled','failed')),
  attempts smallint not null default 0 check (attempts between 0 and 3),
  notification_id uuid references public.ifund_notifications(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ifund_inapp_reminders_due_idx
  on public.ifund_inapp_reminder_queue(next_attempt_at,id)
  where status='queued';
create index if not exists ifund_inapp_reminders_owner_idx
  on public.ifund_inapp_reminder_queue(owner_id,created_at desc);

alter table public.ifund_inapp_reminder_queue enable row level security;
revoke all on table public.ifund_inapp_reminder_queue from public,anon,authenticated;
grant select on table public.ifund_inapp_reminder_queue to authenticated;
drop policy if exists ifund_inapp_reminders_owner_select on public.ifund_inapp_reminder_queue;
create policy ifund_inapp_reminders_owner_select
on public.ifund_inapp_reminder_queue for select to authenticated
using ((select auth.uid())=owner_id
  and (select public.ifund_current_account_is_active()));

create or replace function public.ifund_schedule_inapp_reminder(
  p_request_id uuid, p_title text, p_body text, p_due_at timestamptz
)
returns table(reminder_id uuid, reminder_status text, scheduled_for timestamptz)
language plpgsql volatile security definer
set search_path='' set row_security='off' set lock_timeout='3s'
as $$
declare
  v_owner uuid:=auth.uid();
  v_now timestamptz:=pg_catalog.clock_timestamp();
  v_title text:=btrim(p_title);
  v_body text:=btrim(p_body);
  v_existing public.ifund_inapp_reminder_queue%rowtype;
begin
  if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
     or not coalesce(public.ifund_current_user_has_current_terms(),false)
     or not exists (
       select 1 from auth.users u where u.id=v_owner
         and u.is_anonymous is false and u.email_confirmed_at is not null
     )
  then raise exception 'Verified active account and current terms required' using errcode='42501';end if;
  if p_request_id is null or p_title is null or p_body is null or p_due_at is null
     or char_length(v_title) not between 4 and 100
     or char_length(v_body) not between 8 and 1000
     or p_due_at < v_now + interval '1 minute'
     or p_due_at > v_now + interval '30 days'
  then raise exception 'Provide a title, message and due time 1 minute to 30 days ahead'
     using errcode='22023';end if;

  perform pg_catalog.pg_advisory_xact_lock(19019, pg_catalog.hashtext(v_owner::text));
  select q.* into v_existing from public.ifund_inapp_reminder_queue q
   where q.id=p_request_id;
  if found then
    if v_existing.owner_id<>v_owner or v_existing.title<>v_title
      or v_existing.body<>v_body or v_existing.due_at<>p_due_at
    then raise exception 'Request ID already used for different reminder' using errcode='22023';end if;
    return query select v_existing.id,v_existing.status,v_existing.due_at;
    return;
  end if;
  if (select count(*) from public.ifund_inapp_reminder_queue q
      where q.owner_id=v_owner and q.created_at>=v_now-interval '24 hours')>=10
  then raise exception 'Limit of ten reminders per rolling day reached' using errcode='22023';end if;
  if (select count(*) from public.ifund_inapp_reminder_queue q
      where q.owner_id=v_owner and q.status='queued')>=20
  then raise exception 'Limit of twenty pending reminders reached' using errcode='22023';end if;
  insert into public.ifund_inapp_reminder_queue
    (id,owner_id,title,body,due_at,next_attempt_at)
    values(p_request_id,v_owner,v_title,v_body,p_due_at,p_due_at);
  return query select p_request_id,'queued'::text,p_due_at;
end;
$$;

create or replace function public.ifund_cancel_inapp_reminder(p_reminder_id uuid)
returns table(reminder_id uuid, reminder_status text)
language plpgsql volatile security definer
set search_path='' set row_security='off' set lock_timeout='3s'
as $$
declare v_owner uuid:=auth.uid(); v_status text;
begin
 if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
    or not exists(select 1 from auth.users u where u.id=v_owner
      and u.is_anonymous is false and u.email_confirmed_at is not null)
 then raise exception 'Verified member account required' using errcode='42501';end if;
 if p_reminder_id is null then raise exception 'Reminder ID is required' using errcode='22023';end if;
 update public.ifund_inapp_reminder_queue q
    set status='cancelled',updated_at=now()
    where q.id=p_reminder_id and q.owner_id=v_owner and q.status='queued'
    returning q.status into v_status;
 if v_status is null then
   select q.status into v_status from public.ifund_inapp_reminder_queue q
     where q.id=p_reminder_id and q.owner_id=v_owner;
 end if;
 if v_status is null then raise exception 'Reminder is unavailable' using errcode='42501';end if;
 return query select p_reminder_id,v_status;
end;
$$;

create or replace function public.ifund_dispatch_inapp_reminders(p_limit integer default 40)
returns table(delivered_count integer, retried_count integer, cancelled_count integer)
language plpgsql volatile security definer
set search_path='' set row_security='off' set lock_timeout='4s'
as $$
declare
  v_job record;
  v_notice uuid;
  v_delivered integer:=0;
  v_retried integer:=0;
  v_cancelled integer:=0;
begin
  if p_limit is null or p_limit not between 1 and 100
    then raise exception 'Invalid dispatch batch size' using errcode='22023';end if;
  for v_job in
    select q.id,q.owner_id,q.title,q.body,q.attempts
    from public.ifund_inapp_reminder_queue q
    where q.status='queued' and q.next_attempt_at<=pg_catalog.clock_timestamp()
    order by q.next_attempt_at,q.id
    limit p_limit for update skip locked
  loop
    if not exists (
      select 1 from public.ifund_profiles p
       join auth.users u on u.id=p.id
      where p.id=v_job.owner_id and p.account_status='active'
        and p.account_deletion_pending is false
        and u.is_anonymous is false and u.email_confirmed_at is not null
    ) then
      update public.ifund_inapp_reminder_queue q
         set status='cancelled',updated_at=now()
         where q.id=v_job.id;
      v_cancelled:=v_cancelled+1;
      continue;
    end if;
    begin
      v_notice:=null;
      insert into public.ifund_notifications
        (owner_id,title,body,type,link,canonical_operation_id)
      values(v_job.owner_id,v_job.title,v_job.body,'system','/notifications',
        'inapp-reminder:v1:'||v_job.id::text)
      on conflict (canonical_operation_id)
        where canonical_operation_id is not null do nothing
      returning id into v_notice;
      if v_notice is null then
        select n.id into v_notice from public.ifund_notifications n
        where n.canonical_operation_id='inapp-reminder:v1:'||v_job.id::text
          and n.owner_id=v_job.owner_id;
      end if;
      if v_notice is null then raise exception 'Receipt unavailable';end if;
      update public.ifund_inapp_reminder_queue q
        set status='delivered',notification_id=v_notice,
            attempts=least(v_job.attempts+1,3),updated_at=now()
        where q.id=v_job.id and q.status='queued';
      v_delivered:=v_delivered+1;
    exception when others then
      update public.ifund_inapp_reminder_queue q
      set attempts=least(v_job.attempts+1,3),
          status=case when v_job.attempts+1>=3 then 'failed' else 'queued' end,
          next_attempt_at=now()+make_interval(mins=>2*(v_job.attempts+1)),
          updated_at=now()
       where q.id=v_job.id and q.status='queued';
      v_retried:=v_retried+1;
    end;
  end loop;
  return query select v_delivered,v_retried,v_cancelled;
end;
$$;

revoke all on function public.ifund_schedule_inapp_reminder(uuid,text,text,timestamptz)
 from public,anon,authenticated;
revoke all on function public.ifund_cancel_inapp_reminder(uuid)
 from public,anon,authenticated;
revoke all on function public.ifund_dispatch_inapp_reminders(integer)
 from public,anon,authenticated;
grant execute on function public.ifund_schedule_inapp_reminder(uuid,text,text,timestamptz)
 to authenticated;
grant execute on function public.ifund_cancel_inapp_reminder(uuid)
 to authenticated;
-- Dispatcher is never callable by an ordinary user or an untrusted Worker.
grant execute on function public.ifund_dispatch_inapp_reminders(integer) to postgres;

select cron.schedule(
 'ifund-inapp-reminders-dispatch',
 '*/5 * * * *',
 'select * from public.ifund_dispatch_inapp_reminders(40)'
);
