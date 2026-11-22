-- Remove incompatible daily question ceiling only for a verified $4.99
-- PayPal Premium billing receipt. Provider and infrastructure abuse controls
-- remain independently enforced; trials and other tiers retain daily limits.
-- Remove redundant 50-image rolling-week cap, but retain global Workers AI
-- capacity, cooldown and authenticated access rules.
CREATE OR REPLACE FUNCTION public.ifund_reserve_agent_question(p_request_id uuid, p_input_sha256 text, p_agent_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
 v_owner uuid:=auth.uid();
 v_access jsonb;
 v_limit int;
 v_unlimited boolean:=false;
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
 v_unlimited:=public.ifund_premium_ai_paid_payment_id() is not null;
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
   if not v_unlimited and v_used>=v_limit then
     return jsonb_build_object('allowed',false,'state','daily_limit','limit',v_limit);
   end if;
   update public.ifund_agent_question_usage
     set used_on=v_day,created_at=statement_timestamp(),
         reservation_expires_at=statement_timestamp()+interval '10 minutes',
         completed_at=null,status='reserved'
     where owner_id=v_owner and request_id=p_request_id;
   return jsonb_build_object('allowed',true,'state','reserved','remaining',case when v_unlimited then null else v_limit-v_used-1 end,'limit',case when v_unlimited then null else v_limit end,'unlimited',v_unlimited);
 end if;

 select count(*) into v_used from public.ifund_agent_question_usage
   where owner_id=v_owner and used_on=v_day
     and (status='completed' or (status='reserved' and reservation_expires_at>statement_timestamp()));
 if not v_unlimited and v_used>=v_limit then
   return jsonb_build_object('allowed',false,'state','daily_limit','limit',v_limit);
 end if;
 insert into public.ifund_agent_question_usage(
   owner_id,request_id,input_sha256,agent_id,used_on,status,reservation_expires_at
 ) values (
   v_owner,p_request_id,p_input_sha256,p_agent_id,v_day,'reserved',
   statement_timestamp()+interval '10 minutes'
 );
 return jsonb_build_object('allowed',true,'state','reserved','remaining',case when v_unlimited then null else v_limit-v_used-1 end,'limit',case when v_unlimited then null else v_limit end,'unlimited',v_unlimited);
end
$function$;

CREATE OR REPLACE FUNCTION public.ifund_ai_image_consume_free_quota()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
 SET lock_timeout TO '3s'
AS $function$
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
   -- Paid media consumption is now governed by the single verified 50-item
   -- billing-receipt allowance; retain global per-day free-tier resource caps.
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
 -- No separate seven-day paid-user accounting: the monthly paid content
 -- ledger already charges a successful generated image exactly once.
 return true;
end $function$;
