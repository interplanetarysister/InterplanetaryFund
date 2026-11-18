-- Paid, account-scoped IFund question budget. Source-only until tested.
-- Every member including unknown future signups uses one shared policy.
create table if not exists public.ifund_agent_question_usage (
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  input_sha256 text not null check(input_sha256 ~ '^[a-f0-9]{64}$'),
  agent_id text not null check(agent_id in ('nexus','story','orbit','polaris','forge','echo','pulse','link','discover')),
  used_on date not null default (now() at time zone 'UTC')::date,
  created_at timestamptz not null default now(),
  primary key(owner_id, request_id)
);
create index if not exists ifund_agent_question_usage_daily
  on public.ifund_agent_question_usage(owner_id, used_on);
alter table public.ifund_agent_question_usage enable row level security;
revoke all on public.ifund_agent_question_usage from public,anon,authenticated;

create or replace function public.ifund_reserve_agent_question(
 p_request_id uuid,p_input_sha256 text,p_agent_id text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_owner uuid:=auth.uid();
 v_access jsonb;
 v_limit int;
 v_used int;
 v_old public.ifund_agent_question_usage%rowtype;
 v_day date:=(now() at time zone 'UTC')::date;
begin
 if v_owner is null or p_request_id is null or p_input_sha256 !~ '^[a-f0-9]{64}$'
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
   where owner_id=v_owner and request_id=p_request_id;
 if found then
   if v_old.input_sha256<>p_input_sha256 or v_old.agent_id<>p_agent_id then
     raise exception 'Question idempotency conflict' using errcode='23505';
   end if;
   -- Do not run inference a second time under the same ID, even if previous
   -- transport failed. A new user-initiated request gets a new ID.
   return jsonb_build_object('allowed',false,'state','already_reserved');
 end if;
 select count(*) into v_used from public.ifund_agent_question_usage
   where owner_id=v_owner and used_on=v_day;
 if v_used>=v_limit then
   return jsonb_build_object('allowed',false,'state','daily_limit','limit',v_limit);
 end if;
 insert into public.ifund_agent_question_usage(owner_id,request_id,input_sha256,agent_id,used_on)
   values(v_owner,p_request_id,p_input_sha256,p_agent_id,v_day);
 return jsonb_build_object('allowed',true,'state','reserved','remaining',v_limit-v_used-1,'limit',v_limit);
end $$;
revoke all on function public.ifund_reserve_agent_question(uuid,text,text) from public,anon;
grant execute on function public.ifund_reserve_agent_question(uuid,text,text) to authenticated;
comment on function public.ifund_reserve_agent_question(uuid,text,text) is
 'Per-member, per-day paid advisory AI request quota. Not external publishing permission.';
