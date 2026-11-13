-- NEXUS free scheduled mission briefs. Source-staged, not activated during
-- owner build hold. A separate owner-authorized scheduler must invoke the
-- service-only dispatcher; never expose the privileged dispatcher via browser.
create table if not exists public.ifund_nexus_brief_preferences (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default false,
 frequency_days integer not null default 7 check(frequency_days in (1,7)),
 next_run_at timestamptz,
 last_sent_at timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.ifund_nexus_brief_preferences enable row level security;
revoke all on public.ifund_nexus_brief_preferences from public,anon,authenticated;

create or replace function public.ifund_my_nexus_brief_preferences()
returns table(enabled boolean,frequency_days integer,next_run_at timestamptz,last_sent_at timestamptz)
language plpgsql stable security definer set search_path='' set row_security='off'
as $$
declare v_owner uuid:=auth.uid();
begin
 if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
 then raise exception 'Active owner required' using errcode='42501';end if;
 return query select coalesce(p.enabled,false),coalesce(p.frequency_days,7),
    p.next_run_at,p.last_sent_at
 from (select 1) x left join public.ifund_nexus_brief_preferences p on p.owner_id=v_owner;
end $$;

create or replace function public.ifund_set_nexus_brief_preferences(p_enabled boolean,p_frequency_days integer)
returns boolean language plpgsql volatile security definer set search_path='' set row_security='off'
as $$
declare v_owner uuid:=auth.uid();
begin
 if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
    or not exists(select 1 from auth.users u where u.id=v_owner
      and u.is_anonymous is false and u.email_confirmed_at is not null)
 then raise exception 'Confirmed active owner required' using errcode='42501';end if;
 if p_enabled is null or p_frequency_days not in (1,7)
 then raise exception 'Choose daily or weekly mission briefs' using errcode='22023';end if;
 insert into public.ifund_nexus_brief_preferences(owner_id,enabled,frequency_days,next_run_at)
 values(v_owner,p_enabled,p_frequency_days,case when p_enabled then now()+make_interval(days=>p_frequency_days) else null end)
 on conflict(owner_id) do update set enabled=excluded.enabled,
  frequency_days=excluded.frequency_days,next_run_at=excluded.next_run_at,
  updated_at=now();
 return true;
end $$;

create or replace function public.ifund_dispatch_nexus_briefs(p_limit integer default 100)
returns integer language plpgsql volatile security definer set search_path='' set row_security='off'
as $$
declare r record;v_count integer:=0;v_campaigns bigint;v_key text;
begin
 -- Never permit user sessions to invoke the service dispatcher directly.
 if current_user not in ('postgres','service_role') or p_limit not between 1 and 100
 then raise exception 'Privileged scheduler only' using errcode='42501';end if;
 for r in select p.owner_id,p.frequency_days,p.next_run_at
   from public.ifund_nexus_brief_preferences p
   where p.enabled and p.next_run_at<=now()
   order by p.next_run_at for update skip locked limit p_limit
 loop
   select count(*) into v_campaigns from public.ifund_campaigns c where c.owner_id=r.owner_id;
   v_key:=left('nexus:brief:'||r.owner_id::text||':'||to_char(r.next_run_at at time zone 'UTC','YYYYMMDDHH24MI'),256);
   insert into public.ifund_notifications(owner_id,title,body,type,link,canonical_operation_id)
   values(r.owner_id,'NEXUS campaign mission brief',
     'Your latest mission brief is ready to review. You have '||v_campaigns||' recorded campaigns. Open AI Team to inspect verified priorities and pending agent discussions.',
     'system','/agents',v_key)
   on conflict(canonical_operation_id) where canonical_operation_id is not null do nothing;
   update public.ifund_nexus_brief_preferences p set
     next_run_at=now()+make_interval(days=>r.frequency_days),
     last_sent_at=now(),updated_at=now() where p.owner_id=r.owner_id;
   v_count:=v_count+1;
 end loop;
 return v_count;
end $$;

revoke all on function public.ifund_my_nexus_brief_preferences() from public,anon;
revoke all on function public.ifund_set_nexus_brief_preferences(boolean,integer) from public,anon;
revoke all on function public.ifund_dispatch_nexus_briefs(integer) from public,anon,authenticated;
grant execute on function public.ifund_my_nexus_brief_preferences() to authenticated;
grant execute on function public.ifund_set_nexus_brief_preferences(boolean,integer) to authenticated;
grant execute on function public.ifund_dispatch_nexus_briefs(integer) to service_role;

-- SEPARATE approved scheduler setup (NOT EXECUTED by this migration):
-- select cron.schedule('ifund-nexus-daily-briefs','0 15 * * *',
--   'select public.ifund_dispatch_nexus_briefs(100)');
