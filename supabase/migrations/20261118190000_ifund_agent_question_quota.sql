-- Paid, account-scoped IFund question budget with recoverable reservations.
-- Failed inference does not permanently consume a member's daily question allowance.
create table if not exists public.ifund_agent_question_usage (
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  input_sha256 text not null check(input_sha256 ~ '^[a-f0-9]{64}$'),
  agent_id text not null check(agent_id in ('nexus','story','orbit','polaris','forge','echo','pulse','link','discover')),
  used_on date not null default (now() at time zone 'UTC')::date,
  created_at timestamptz not null default now(),
  status text not null default 'reserved',
  reservation_expires_at timestamptz not null default (now() + interval '10 minutes'),
  completed_at timestamptz,
  primary key(owner_id, request_id)
);

alter table public.ifund_agent_question_usage
  add column if not exists status text not null default 'reserved',
  add column if not exists reservation_expires_at timestamptz not null default (now() + interval '10 minutes'),
  add column if not exists completed_at timestamptz;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.ifund_agent_question_usage'::regclass
      and conname='ifund_agent_question_usage_status_check'
  ) then
    alter table public.ifund_agent_question_usage
      add constraint ifund_agent_question_usage_status_check
      check (status in ('reserved','completed'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.ifund_agent_question_usage'::regclass
      and conname='ifund_agent_question_usage_completion_check'
  ) then
    alter table public.ifund_agent_question_usage
      add constraint ifund_agent_question_usage_completion_check
      check (
        (status='reserved' and completed_at is null and reservation_expires_at is not null)
        or
        (status='completed' and completed_at is not null and reservation_expires_at is null)
      );
  end if;
end
$constraints$;

create index if not exists ifund_agent_question_usage_daily
  on public.ifund_agent_question_usage(owner_id, used_on);
create index if not exists ifund_agent_question_usage_reservation_expiry
  on public.ifund_agent_question_usage(owner_id, reservation_expires_at)
  where status='reserved';

alter table public.ifund_agent_question_usage enable row level security;
revoke all on public.ifund_agent_question_usage from public,anon,authenticated;

create or replace function public.ifund_reserve_agent_question(
 p_request_id uuid,p_input_sha256 text,p_agent_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = 'off'
as $function$
declare
 v_owner uuid:=auth.uid();
 v_access jsonb;
 v_limit int;
 v_used int;
 v_old public.ifund_agent_question_usage%rowtype;
 v_day date:=(now() at time zone 'UTC')::date;
begin
 if v_owner is null or p_request_id is null or p_input_sha256 is null
   or p_input_sha256 !~ '^[a-f0-9]{64}$' or p_agent_id is null
   or p_agent_id not in ('nexus','story','orbit','polaris','forge','echo','pulse','link','discover')
   or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
   raise exception 'Invalid question request or account' using errcode='22023';
 end if;
 if not coalesce(public.ifund_current_account_is_active(),false) then
   raise exception 'Active account required' using errcode='42501';
 end if;
 v_access:=public.ifund_story_subscription();
 if coalesce((v_access->>'active')::boolean,false) is not true
    or coalesce((v_access->>'level')::integer,0)<1 then
   raise exception 'A verified paid AI membership is required for agent answers'
     using errcode='42501';
 end if;
 v_limit:=case when (v_access->>'level')::integer>=3 then 60
               when (v_access->>'level')::integer>=2 then 40 else 20 end;
 perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':'||v_day::text,0));

 select * into v_old from public.ifund_agent_question_usage
   where owner_id=v_owner and request_id=p_request_id for update;
 if found then
   if v_old.input_sha256<>p_input_sha256 or v_old.agent_id<>p_agent_id then
     raise exception 'Question idempotency conflict' using errcode='23505';
   end if;
   if v_old.status='completed'
      or v_old.reservation_expires_at > statement_timestamp() then
     return jsonb_build_object('allowed',false,'state','already_reserved');
   end if;
   select count(*) into v_used from public.ifund_agent_question_usage
     where owner_id=v_owner and used_on=v_day
       and (status='completed' or (status='reserved' and reservation_expires_at>statement_timestamp()));
   if v_used>=v_limit then
     return jsonb_build_object('allowed',false,'state','daily_limit','limit',v_limit);
   end if;
   update public.ifund_agent_question_usage
     set used_on=v_day,created_at=statement_timestamp(),
         reservation_expires_at=statement_timestamp()+interval '10 minutes',
         completed_at=null,status='reserved'
     where owner_id=v_owner and request_id=p_request_id;
   return jsonb_build_object('allowed',true,'state','reserved','remaining',v_limit-v_used-1,'limit',v_limit);
 end if;

 select count(*) into v_used from public.ifund_agent_question_usage
   where owner_id=v_owner and used_on=v_day
     and (status='completed' or (status='reserved' and reservation_expires_at>statement_timestamp()));
 if v_used>=v_limit then
   return jsonb_build_object('allowed',false,'state','daily_limit','limit',v_limit);
 end if;
 insert into public.ifund_agent_question_usage(
   owner_id,request_id,input_sha256,agent_id,used_on,status,reservation_expires_at
 ) values (
   v_owner,p_request_id,p_input_sha256,p_agent_id,v_day,'reserved',
   statement_timestamp()+interval '10 minutes'
 );
 return jsonb_build_object('allowed',true,'state','reserved','remaining',v_limit-v_used-1,'limit',v_limit);
end
$function$;

create or replace function public.ifund_complete_agent_question(
 p_request_id uuid,p_input_sha256 text,p_agent_id text
) returns boolean
language plpgsql
security definer
set search_path = ''
set row_security = 'off'
as $function$
declare
 v_owner uuid:=auth.uid();
begin
 if v_owner is null or p_request_id is null or p_input_sha256 is null
    or p_input_sha256 !~ '^[a-f0-9]{64}$' or p_agent_id is null then
   raise exception 'Invalid question completion reference' using errcode='22023';
 end if;
 update public.ifund_agent_question_usage
   set status='completed',completed_at=statement_timestamp(),reservation_expires_at=null
   where owner_id=v_owner and request_id=p_request_id
     and input_sha256=p_input_sha256 and agent_id=p_agent_id and status='reserved'
     and reservation_expires_at>statement_timestamp();
 if found then return true; end if;
 return exists (
   select 1 from public.ifund_agent_question_usage
   where owner_id=v_owner and request_id=p_request_id
     and input_sha256=p_input_sha256 and agent_id=p_agent_id and status='completed'
 );
end
$function$;

create or replace function public.ifund_release_agent_question(
 p_request_id uuid,p_input_sha256 text,p_agent_id text
) returns boolean
language plpgsql
security definer
set search_path = ''
set row_security = 'off'
as $function$
declare
 v_owner uuid:=auth.uid();
begin
 if v_owner is null or p_request_id is null or p_input_sha256 is null
    or p_input_sha256 !~ '^[a-f0-9]{64}$' or p_agent_id is null then
   raise exception 'Invalid question release reference' using errcode='22023';
 end if;
 delete from public.ifund_agent_question_usage
   where owner_id=v_owner and request_id=p_request_id
     and input_sha256=p_input_sha256 and agent_id=p_agent_id and status='reserved';
 return found;
end
$function$;

revoke all on function public.ifund_reserve_agent_question(uuid,text,text) from public,anon;
revoke all on function public.ifund_complete_agent_question(uuid,text,text) from public,anon;
revoke all on function public.ifund_release_agent_question(uuid,text,text) from public,anon;
grant execute on function public.ifund_reserve_agent_question(uuid,text,text) to authenticated;
grant execute on function public.ifund_complete_agent_question(uuid,text,text) to authenticated;
grant execute on function public.ifund_release_agent_question(uuid,text,text) to authenticated;
comment on function public.ifund_reserve_agent_question(uuid,text,text) is
 'Reserves a per-member daily paid advisory AI question allowance with an expiring reservation.';
comment on function public.ifund_complete_agent_question(uuid,text,text) is
 'Finalizes a successful advisory AI question so it counts against the daily allowance.';
comment on function public.ifund_release_agent_question(uuid,text,text) is
 'Releases only the current owner’s failed/incomplete advisory AI reservation.';
