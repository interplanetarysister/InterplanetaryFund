-- Administrators receive paid feature access without creating a financial receipt.
-- Preserve verified-account, accepted terms, owner authorization and provider consent.
-- Global provider capacity and pacing remain unchanged.
CREATE OR REPLACE FUNCTION public.ifund_funding_paid_access()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(public.ifund_member_connection_allowed(),false)
 and coalesce(public.ifund_current_user_has_current_terms(),false)
 and (public.ifund_current_user_is_verified_admin() is true
 or exists(select 1 from ifund_access.member_entitlements e where e.owner_id=auth.uid()
  and e.status='active' and e.tier in('basic','outreach','nonprofit','professional','enterprise')
  and e.verified_at<=clock_timestamp() and e.valid_until>clock_timestamp()))
$function$;
CREATE OR REPLACE FUNCTION public.ifund_ai_content_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
 v_owner uuid:=auth.uid();
 v_ent jsonb;
 v_payment uuid;
 v_used int;
begin
 if v_owner is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
   or not coalesce(public.ifund_current_account_is_active(),false) then
  raise exception 'Verified member required' using errcode='42501';
 end if;
 perform public.ifund_agent_referral_status();
 v_ent:=ifund_story_runtime.subscription();
 if v_ent->>'status'='trialing' then
   return public.ifund_trial_ai_generation_status();
 end if;
 if coalesce((v_ent->>'admin_granted')::boolean,false) then
   return jsonb_build_object('limit',null,'remaining',null,'used',0,'trial',false,'paid',false,'admin',true,'entitled',true);
 end if;
 v_payment:=public.ifund_premium_ai_paid_payment_id();
 if v_payment is null then
   return jsonb_build_object('limit',50,'used',0,'remaining',0,'trial',false,'paid',false,'entitled',false);
 end if;
 select count(*)::int into v_used from public.ifund_paid_ai_generations
 where owner_id=v_owner and payment_id=v_payment
   and (state='completed' or (state='reserved' and reserved_until>statement_timestamp()));
 return jsonb_build_object('limit',50,'used',v_used,'remaining',greatest(0,50-v_used),
   'trial',false,'paid',true,'entitled',true);
end $function$;
CREATE OR REPLACE FUNCTION public.ifund_ai_image_access_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
 v_owner uuid:=auth.uid();
 v_ref jsonb;
 v_sub jsonb;
 v_is_paid boolean;
 v_paid_used integer:=0;
begin
 if v_owner is null
   or not coalesce(public.ifund_member_connection_allowed(),false)
   or not coalesce(public.ifund_current_user_has_current_terms(),false)
 then raise exception 'Verified account required' using errcode='42501'; end if;
 v_ref:=public.ifund_agent_referral_status();
 v_sub:=ifund_story_runtime.subscription();
 v_is_paid:=v_sub->>'status'='active'
   and coalesce((v_sub->>'admin_granted')::boolean,false) is false
   and coalesce(v_sub->>'tier','free')<>'free';
 if v_is_paid then
   select count(*)::integer into v_paid_used
   from ifund_ops.ai_image_paid_attempts
   where owner_id=v_owner and attempted_at>clock_timestamp()-interval '7 days';
 end if;
 return jsonb_build_object(
   'entitled',coalesce((v_sub->>'active')::boolean,false),
   'trial_enabled',coalesce((v_ref->>'trial_enabled')::boolean,false),
   'trial_expires_at',v_ref->>'trial_expires_at',
   'pending_hours',coalesce((v_ref->>'pending_hours')::integer,0),
   'tier',v_sub->>'tier',
   'status',v_sub->>'status',
   'admin_granted',coalesce((v_sub->>'admin_granted')::boolean,false),
   'unlimited_member_allowance',coalesce((v_sub->>'admin_granted')::boolean,false),
   'paid_weekly_limit',case when v_is_paid then 50 else null end,
   'paid_weekly_used',case when v_is_paid then v_paid_used else null end,
   'paid_weekly_remaining',case when v_is_paid then greatest(0,50-v_paid_used) else null end,
   'paid_weekly_window','rolling_7_days',
   'shared_daily_capacity',50,
   'per_user_daily_limit',null,
   'minimum_seconds_between_attempts',10
 );
end $function$;
do $verify$
begin
 if has_function_privilege('anon','public.ifund_funding_paid_access()','EXECUTE') or
    not has_function_privilege('authenticated','public.ifund_funding_paid_access()','EXECUTE') then
 raise exception 'Funding access grant regression'; end if;
 if public.ifund_funding_paid_access() then raise exception 'Unauthenticated funding access'; end if;
end $verify$;
