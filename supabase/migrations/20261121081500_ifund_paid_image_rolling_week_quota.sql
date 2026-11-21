-- Paid iFund image allowance: 50 charged generation/improvement attempts
-- per rolling seven-day window. Trial access remains time-based, without
-- a per-member generation counter; both share existing global hosting limits.
-- A paid subscription is ONLY one with verified provider-backed status=active.
-- No user/browser editable field, trial flag, or referral claim grants paid access.
create table if not exists ifund_ops.ai_image_paid_attempts (
  attempt_id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default clock_timestamp()
);
create index if not exists ai_image_paid_attempts_owner_time_idx
  on ifund_ops.ai_image_paid_attempts(owner_id,attempted_at desc);
alter table ifund_ops.ai_image_paid_attempts enable row level security;
revoke all on table ifund_ops.ai_image_paid_attempts from public,anon,authenticated;
revoke all on sequence ifund_ops.ai_image_paid_attempts_attempt_id_seq from public,anon,authenticated;

create or replace function public.ifund_ai_image_consume_free_quota()
returns boolean language plpgsql volatile security definer
set search_path to '' set row_security to 'off' set lock_timeout to '3s'
as $fn$
declare
 v_owner uuid:=auth.uid();
 v_now timestamptz;
 v_date date;
 v_total integer;
 v_attempts integer;
 v_paid_used integer;
 v_sub jsonb;
 v_is_paid boolean;
begin
 if v_owner is null
   or not coalesce(public.ifund_member_connection_allowed(),false)
   or not coalesce(public.ifund_current_user_has_current_terms(),false)
 then raise exception 'Active, verified member and accepted terms required'
   using errcode='42501';
 end if;
 -- Activate first signup trial / apply earned 24h referral credits.
 perform public.ifund_agent_referral_status();
 v_sub:=ifund_story_runtime.subscription();
 if coalesce((v_sub->>'active')::boolean,false) is not true
 then return false; end if;

 v_is_paid:=v_sub->>'status'='active'
   and coalesce((v_sub->>'admin_granted')::boolean,false) is false
   and coalesce(v_sub->>'tier','free')<>'free';
 -- This global transaction lock serializes paid-window, pacing and
 -- shared-budget changes under concurrent members/invocations.
 perform pg_catalog.pg_advisory_xact_lock(20261113,50);
 v_now:=clock_timestamp();
 v_date:=(v_now at time zone 'UTC')::date;
 delete from ifund_ops.ai_image_daily as expired where expired.quota_date<v_date-7;
 -- Only records required to enforce a seven-day rolling window survive.
 delete from ifund_ops.ai_image_paid_attempts where attempted_at<=v_now-interval '7 days';
 if v_is_paid then
   select count(*)::integer into v_paid_used
   from ifund_ops.ai_image_paid_attempts
   where owner_id=v_owner and attempted_at>v_now-interval '7 days';
   if v_paid_used>=50 then return false; end if;
 end if;
 -- Actual Workers AI free-tier capacity remains a strict platform cap.
 select coalesce(sum(q.attempts),0)::integer into v_total
 from ifund_ops.ai_image_daily q where q.quota_date=v_date;
 if v_total>=50 then return false; end if;

 -- A generation or enhancement attempt counts after admission, even if
 -- inference later fails; this prevents free retries from causing spending.
 insert into ifund_ops.ai_image_daily as q
  (quota_date,owner_id,attempts,last_attempt_at)
 values(v_date,v_owner,1,v_now)
 on conflict(quota_date,owner_id)
 do update set attempts=q.attempts+1,last_attempt_at=v_now
 where q.last_attempt_at is null or q.last_attempt_at<=v_now-interval '10 seconds'
 returning attempts into v_attempts;
 if v_attempts is null then return false; end if;
 if v_is_paid then
  insert into ifund_ops.ai_image_paid_attempts(owner_id,attempted_at)
  values(v_owner,v_now);
 end if;
 return true;
end $fn$;
revoke all on function public.ifund_ai_image_consume_free_quota()
 from public,anon,authenticated;
grant execute on function public.ifund_ai_image_consume_free_quota()
 to authenticated;
comment on function public.ifund_ai_image_consume_free_quota() is
 'Verified paid plan: 50 image attempts rolling 7 days. Enabled signup/referral trial: time-limited without personal attempt cap. Shared platform 50 attempts/UTC day, 10-second pacing; requests charged before inference.';

-- Read-only self-check. It must never call the mutating referral-status RPC:
-- opening the studio cannot start or extend a trial. Trial activation remains
-- confined to the quota-consuming RPC below.
create or replace function public.ifund_ai_image_access_status()
returns jsonb language plpgsql stable security definer
set search_path to '' set row_security to 'off'
as $fn$
declare
 v_owner uuid:=auth.uid();
 v_sub jsonb;
 v_is_paid boolean;
 v_paid_used integer:=0;
 v_control_enabled boolean:=false;
 v_trial_expires_at timestamptz;
 v_pending_hours bigint:=0;
begin
 if v_owner is null
   or not coalesce(public.ifund_member_connection_allowed(),false)
   or not coalesce(public.ifund_current_user_has_current_terms(),false)
 then raise exception 'Verified account required' using errcode='42501'; end if;
 v_sub:=ifund_story_runtime.subscription();
 v_is_paid:=v_sub->>'status'='active'
   and coalesce((v_sub->>'admin_granted')::boolean,false) is false
   and coalesce(v_sub->>'tier','free')<>'free';
 if v_is_paid then
   select count(*)::integer into v_paid_used
   from ifund_ops.ai_image_paid_attempts
   where owner_id=v_owner and attempted_at>statement_timestamp()-interval '7 days';
 end if;
 select c.enabled,t.trial_expires_at,t.pending_hours
   into v_control_enabled,v_trial_expires_at,v_pending_hours
 from public.ifund_agent_trial_control c
 left join public.ifund_referral_trial_accounts t on t.owner_id=v_owner
 where c.singleton is true;
 return jsonb_build_object(
   'entitled',coalesce((v_sub->>'active')::boolean,false),
   'trial_enabled',coalesce(v_control_enabled,false),
   'trial_expires_at',case
     when coalesce(v_control_enabled,false) and v_trial_expires_at>statement_timestamp()
     then v_trial_expires_at else null end,
   'pending_hours',coalesce(v_pending_hours,0),
   'tier',v_sub->>'tier',
   'status',v_sub->>'status',
   'paid_weekly_limit',case when v_is_paid then 50 else null end,
   'paid_weekly_used',case when v_is_paid then v_paid_used else null end,
   'paid_weekly_remaining',case when v_is_paid then greatest(0,50-v_paid_used) else null end,
   'paid_weekly_window','rolling_7_days',
   'shared_daily_capacity',50,
   'per_user_daily_limit',null,
   'minimum_seconds_between_attempts',10
 );
end $fn$;
revoke all on function public.ifund_ai_image_access_status()
 from public,anon,authenticated;
grant execute on function public.ifund_ai_image_access_status()
 to authenticated;
comment on function public.ifund_ai_image_access_status() is
 'Read-only account-scoped paid image use (50 attempts / rolling 7d) and verified trial status; it neither starts nor extends a trial and does not guarantee global provider capacity.';
