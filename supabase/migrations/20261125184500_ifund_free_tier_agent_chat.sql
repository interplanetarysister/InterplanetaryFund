-- Verified free-tier members may ask up to five agent questions per UTC day.
-- Higher-tier receipts and verified admin privileges keep their existing grants.
-- Uses existing verified-account, consent, RLS, reservation/idempotency and abuse controls.
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
 if coalesce(v_access->>'tier','') not in ('free','basic','outreach','nonprofit','professional','enterprise')
    or coalesce((v_access->>'level')::integer,-1)<0 then
   raise exception 'A verified, active member account is required for agent answers'
     using errcode='42501';
 end if;
 v_unlimited:=coalesce((v_access->>'admin_granted')::boolean,false) is true
   or public.ifund_premium_ai_paid_payment_id() is not null;
 v_limit:=case when (v_access->>'level')::integer>=3 then 60
               when (v_access->>'level')::integer>=2 then 40
               when (v_access->>'level')::integer>=1 then 20 else 5 end;
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
$function$
;
revoke all on function public.ifund_reserve_agent_question(uuid,text,text) from public,anon,authenticated;
grant execute on function public.ifund_reserve_agent_question(uuid,text,text) to authenticated;

comment on function public.ifund_reserve_agent_question(uuid,text,text) is
 'Reserves an authenticated agent advisory question: five daily for free tier, existing paid limits or verified premium/admin unlimited grants. No external action permission.';
