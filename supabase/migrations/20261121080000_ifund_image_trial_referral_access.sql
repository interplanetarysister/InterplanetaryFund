-- IFund artwork access: no per-owner numeric attempt ceiling while the active
-- 24-hour verified signup/referral trial OR provider-backed paid plan is valid.
-- Shared free-hosting capacity is NOT unlimited. Preserve account-wide 50/day.
-- The preexisting trial engine adds 24h per verified first-campaign referral.
-- No automatic charge, plan enrollment, provider impersonation or free credits.
alter table ifund_ops.ai_image_daily
  drop constraint if exists ai_image_daily_attempts_check;
alter table ifund_ops.ai_image_daily
  add constraint ai_image_daily_attempts_check check (attempts between 0 and 5000);
alter table ifund_ops.ai_image_daily
  add column if not exists last_attempt_at timestamptz;

create or replace function public.ifund_ai_image_consume_free_quota()
returns boolean language plpgsql volatile security definer
set search_path to '' set row_security to 'off' set lock_timeout to '3s'
as $fn$
declare
 v_owner uuid:=auth.uid();
 v_date date;
 v_total integer;
 v_attempts integer;
 v_sub jsonb;
begin
 if v_owner is null
   or not coalesce(public.ifund_member_connection_allowed(),false)
   or not coalesce(public.ifund_current_user_has_current_terms(),false)
 then raise exception 'Active, verified member and accepted terms required'
   using errcode='42501';
 end if;

 -- The existing referral-trial RPC initializes the signup window only when
 -- the operator has enabled the verified AI service. It also applies banked
 -- 24h referral rewards. This write runs inside the same SQL transaction.
 perform public.ifund_agent_referral_status();
 v_sub:=ifund_story_runtime.subscription();
 if coalesce((v_sub->>'active')::boolean,false) is not true
 then return false; end if;

 -- Serial global quota across users; never create unlimited provider costs.
 perform pg_catalog.pg_advisory_xact_lock(20261113,50);
 v_date:=(clock_timestamp() at time zone 'UTC')::date;
 delete from ifund_ops.ai_image_daily as expired where expired.quota_date < v_date-7;
 select coalesce(sum(q.attempts),0)::integer into v_total
 from ifund_ops.ai_image_daily q where q.quota_date=v_date;
 if v_total>=50 then return false; end if;

 -- No per-user attempt count ceiling. A short pacing interval blocks scripts
 -- from exhausting all free provider capacity in one burst. Attempts charged
 -- before inference, including provider errors, to discourage abuse.
 insert into ifund_ops.ai_image_daily as q
  (quota_date,owner_id,attempts,last_attempt_at)
 values(v_date,v_owner,1,clock_timestamp())
 on conflict(quota_date,owner_id)
 do update set attempts=q.attempts+1,last_attempt_at=clock_timestamp()
 where q.last_attempt_at is null
  or q.last_attempt_at <= clock_timestamp()-interval '10 seconds'
 returning attempts into v_attempts;
 return v_attempts is not null;
end $fn$;

revoke all on function public.ifund_ai_image_consume_free_quota()
 from public,anon,authenticated;
grant execute on function public.ifund_ai_image_consume_free_quota()
 to authenticated;
comment on function public.ifund_ai_image_consume_free_quota() is
 'Owner-verified AI image request; active provider-backed plan or enabled 24h signup/referral trial; no per-owner daily cap, global 50/day and 10-second pacing to protect free infrastructure.';

-- Explicit read-only self-check for truthful frontend access notices, with
-- neither image-provider billing state nor referral ownership leaked.
create or replace function public.ifund_ai_image_access_status()
returns jsonb language plpgsql volatile security definer
set search_path to '' set row_security to 'off'
as $fn$
declare
 v_owner uuid:=auth.uid();
 v_ref jsonb;
 v_sub jsonb;
begin
 if v_owner is null
   or not coalesce(public.ifund_member_connection_allowed(),false)
   or not coalesce(public.ifund_current_user_has_current_terms(),false)
 then raise exception 'Verified account required' using errcode='42501'; end if;
 v_ref:=public.ifund_agent_referral_status();
 v_sub:=ifund_story_runtime.subscription();
 return jsonb_build_object(
   'entitled',coalesce((v_sub->>'active')::boolean,false),
   'trial_enabled',coalesce((v_ref->>'trial_enabled')::boolean,false),
   'trial_expires_at',v_ref->>'trial_expires_at',
   'pending_hours',coalesce((v_ref->>'pending_hours')::integer,0),
   'tier',v_sub->>'tier',
   'status',v_sub->>'status',
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
 'Authenticated image entitlement and 24h signup / qualified-referral expiry, not a promise of available provider inference.';
