-- Free-tier AI generation allowance: one shared pool of 15 generations per
-- rolling 7 days for every non-subscriber (owner directive, 2026-11-28).
--
-- SOURCE ONLY — not applied to production. Activation requires applying
-- this migration to the hosted Supabase project through the controlled
-- release process; until then the live functions keep the prior shape.
--
-- What changes, relative to 20261122123000 / 20261122150000:
--   * The capped population is every non-subscriber: a basic trial OR a
--     free account with no subscription. Free accounts previously received
--     membership_required from ifund_ai_content_reserve; they now draw
--     from the same shared pool as trials.
--   * The cap counts a rolling 7-day window instead of all time: a
--     completed generation counts for 7 days from completion, a live
--     reservation counts until its existing 30-minute expiry. The pool
--     therefore replenishes continuously. No calendar-week anchor exists
--     anywhere in the prior code, and the paid image quota already uses a
--     rolling week (20261121081500), so rolling is the house pattern.
--   * Reserve/complete/idempotency/fail-closed semantics, the shared
--     15-item pool across kinds ('campaign_story','image','image_edit',
--     'video','audio','marketing'), and the 30-minute reservation expiry
--     are unchanged.
--
-- What does NOT change:
--   * Subscribers: verified Premium keeps its 50 monthly credits keyed to
--     the verified payment (20261122150000); admin exemption unchanged;
--     the Refine Knowledge server-side tier gate is untouched.
--   * Day passes: ifund_ai_content_reserve still returns
--     membership_required for day-pass accounts (the entitlement question
--     remains an open owner decision), and a direct call to the trial
--     reserve keeps its prior paid_or_admin_exempt outcome for any active
--     non-trial entitlement, exactly as before.
--   * Referral machinery: codes, claims, the +24h trial extensions and
--     pending_hours are untouched and still run first in every reserve.
--     Referral trial windows still grant basic-tier agent access while
--     active. Their former side effect on content generation — extending
--     the window in which the 15 lifetime items could be spent — is
--     superseded by this standing weekly pool; converting successful
--     referrals into bonus weekly generations is an owner decision and
--     is deliberately NOT invented here.
-- The backing table keeps its historical name (ifund_trial_ai_generations);
-- renaming a live table is not an additive change. It now backs the free
-- weekly pool for trials and free accounts alike.

create or replace function public.ifund_trial_ai_generation_reserve(p_request_id uuid,p_kind text)
returns jsonb language plpgsql volatile security definer
set search_path='' set row_security='off' set lock_timeout='4s'
as $body$
declare
 v_uid uuid:=auth.uid();
 v_ent jsonb;
 v_count integer;
 v_existing public.ifund_trial_ai_generations%rowtype;
begin
 if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
    or p_request_id is null or p_kind is null
    or p_kind not in ('campaign_story','image','image_edit','video','audio','marketing')
    or not coalesce(public.ifund_current_user_has_current_terms(),false)
    or not coalesce(public.ifund_current_account_is_active(),false) then
    raise exception 'Verified and authorized account required' using errcode='42501';
 end if;
 -- Referral bookkeeping still runs first: it issues the member's code,
 -- starts any referral trial and banks referral hours exactly as before.
 perform public.ifund_agent_referral_status();
 v_ent:=ifund_story_runtime.subscription();
 -- Verified paid, day-pass and admin accounts keep the prior untracked
 -- exemption on this direct path. ifund_ai_content_reserve routes paid
 -- members to their monthly credits and day passes to membership_required
 -- before reaching here, unchanged. Everyone else — a basic trial or a
 -- free account with no subscription — draws from the weekly pool.
 if coalesce((v_ent->>'active')::boolean,false)
    and v_ent->>'status'<>'trialing' then
    return jsonb_build_object('allowed',true,'state','paid_or_admin_exempt','limit',null);
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ifund-trial-ai:'||v_uid::text,0));
 select * into v_existing from public.ifund_trial_ai_generations
 where owner_id=v_uid and request_id=p_request_id for update;
 if found then
   if v_existing.kind<>p_kind then
     raise exception 'Trial generation idempotency conflict' using errcode='23505';
   end if;
   if v_existing.state='completed' then
     return jsonb_build_object('allowed',false,'state','already_completed','limit',15);
   end if;
   if v_existing.reserved_until>statement_timestamp() then
     return jsonb_build_object('allowed',false,'state','already_reserved','limit',15);
   end if;
 end if;
 -- Rolling 7-day window: completions count for 7 days from completion;
 -- live reservations count until they expire (30 minutes, unchanged).
 select count(*)::integer into v_count from public.ifund_trial_ai_generations
  where owner_id=v_uid
    and ((state='completed' and completed_at>statement_timestamp()-interval '7 days')
      or (state='reserved' and reserved_until>statement_timestamp()));
 if v_count>=15 then
   return jsonb_build_object('allowed',false,'state','trial_limit','limit',15,'remaining',0,
     'window','rolling_7_day');
 end if;
 insert into public.ifund_trial_ai_generations
   (owner_id,request_id,kind,state,reserved_until,completed_at)
 values(v_uid,p_request_id,p_kind,'reserved',statement_timestamp()+interval '30 minutes',null)
 on conflict(owner_id,request_id) do update
  set state='reserved',reserved_until=statement_timestamp()+interval '30 minutes',completed_at=null
  where public.ifund_trial_ai_generations.state='reserved'
   and public.ifund_trial_ai_generations.reserved_until<=statement_timestamp();
 if not found then
  return jsonb_build_object('allowed',false,'state','already_reserved','limit',15);
 end if;
 return jsonb_build_object('allowed',true,'state','reserved','limit',15,
   'remaining',15-v_count-1,'window','rolling_7_day');
end $body$;

create or replace function public.ifund_trial_ai_generation_status()
returns jsonb language plpgsql volatile security definer
set search_path='' set row_security='off'
as $body$
declare
 v_uid uuid:=auth.uid();v_ent jsonb;v_used integer;
begin
 if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
   or not coalesce(public.ifund_current_account_is_active(),false) then
   raise exception 'Verified member required' using errcode='42501';
 end if;
 perform public.ifund_agent_referral_status();
 v_ent:=ifund_story_runtime.subscription();
 select count(*)::integer into v_used from public.ifund_trial_ai_generations
  where owner_id=v_uid
    and ((state='completed' and completed_at>statement_timestamp()-interval '7 days')
      or (state='reserved' and reserved_until>statement_timestamp()));
 return jsonb_build_object('limit',15,'used',v_used,'remaining',greatest(0,15-v_used),
   'trial',v_ent->>'status'='trialing',
   'free_pool',v_ent->>'status'='trialing' or v_ent->>'tier'='free',
   'window','rolling_7_day','window_days',7,
   'entitled',coalesce((v_ent->>'active')::boolean,false) or v_ent->>'tier'='free');
end $body$;

create or replace function public.ifund_ai_content_reserve(p_request_id uuid,p_kind text)
returns jsonb language plpgsql volatile security definer
set search_path='' set row_security='off' set lock_timeout='4s'
as $body$
declare
 v_owner uuid:=auth.uid();
 v_ent jsonb;
 v_payment uuid;
 v_used int;
 v_old public.ifund_paid_ai_generations%rowtype;
begin
 if v_owner is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
  or p_request_id is null or p_kind is null
  or p_kind not in ('campaign_story','image','image_edit','video','audio','marketing')
  or not coalesce(public.ifund_current_user_has_current_terms(),false)
  or not coalesce(public.ifund_current_account_is_active(),false)
 then raise exception 'Active verified member and valid request required' using errcode='42501'; end if;
 perform public.ifund_agent_referral_status();
 v_ent:=ifund_story_runtime.subscription();
 -- Non-subscribers (a basic trial, or a free account with no subscription)
 -- share the weekly 15-generation pool. Subscriber routing below is
 -- unchanged: admin exemption first, then verified Premium monthly credits;
 -- day passes still fall through to membership_required, as before.
 if v_ent->>'status'='trialing' or v_ent->>'tier'='free' then
   return public.ifund_trial_ai_generation_reserve(p_request_id,p_kind);
 end if;
 if coalesce((v_ent->>'admin_granted')::boolean,false) then
   return jsonb_build_object('allowed',true,'state','admin_exempt','limit',null);
 end if;
 v_payment:=public.ifund_premium_ai_paid_payment_id();
 if v_payment is null then
   return jsonb_build_object('allowed',false,'state','membership_required','limit',50);
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ifund-premium-ai:'||v_owner::text,0));
 select * into v_old from public.ifund_paid_ai_generations
  where owner_id=v_owner and request_id=p_request_id for update;
 if found then
   if v_old.kind<>p_kind or v_old.payment_id<>v_payment then
      raise exception 'Paid generation idempotency conflict' using errcode='23505';
   end if;
   if v_old.state='completed' then
      return jsonb_build_object('allowed',false,'state','already_completed','limit',50);
   end if;
   if v_old.reserved_until>statement_timestamp() then
      return jsonb_build_object('allowed',false,'state','already_reserved','limit',50);
   end if;
 end if;
 select count(*)::int into v_used from public.ifund_paid_ai_generations
  where owner_id=v_owner and payment_id=v_payment
   and (state='completed' or (state='reserved' and reserved_until>statement_timestamp()));
 if v_used>=50 then
   return jsonb_build_object('allowed',false,'state','monthly_limit','limit',50,'remaining',0);
 end if;
 insert into public.ifund_paid_ai_generations(owner_id,request_id,payment_id,kind,state,reserved_until)
 values(v_owner,p_request_id,v_payment,p_kind,'reserved',statement_timestamp()+interval '30 minutes')
 on conflict(owner_id,request_id) do update
  set state='reserved',reserved_until=statement_timestamp()+interval '30 minutes',completed_at=null
  where public.ifund_paid_ai_generations.payment_id=v_payment
    and public.ifund_paid_ai_generations.kind=p_kind
    and public.ifund_paid_ai_generations.state='reserved'
    and public.ifund_paid_ai_generations.reserved_until<=statement_timestamp();
 if not found then
   return jsonb_build_object('allowed',false,'state','already_reserved','limit',50);
 end if;
 return jsonb_build_object('allowed',true,'state','reserved','limit',50,'remaining',49-v_used);
end $body$;

create or replace function public.ifund_ai_content_status()
returns jsonb language plpgsql volatile security definer
set search_path='' set row_security='off'
as $body$
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
 if v_ent->>'status'='trialing' or v_ent->>'tier'='free' then
   return public.ifund_trial_ai_generation_status();
 end if;
 if coalesce((v_ent->>'admin_granted')::boolean,false) then
   return jsonb_build_object('limit',null,'remaining',null,'used',0,'trial',false,'paid',false,'admin',true);
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
end $body$;

revoke all on function public.ifund_trial_ai_generation_reserve(uuid,text) from public,anon,authenticated;
revoke all on function public.ifund_trial_ai_generation_status() from public,anon,authenticated;
revoke all on function public.ifund_ai_content_reserve(uuid,text) from public,anon,authenticated;
revoke all on function public.ifund_ai_content_status() from public,anon,authenticated;
grant execute on function public.ifund_trial_ai_generation_reserve(uuid,text) to authenticated;
grant execute on function public.ifund_trial_ai_generation_status() to authenticated;
grant execute on function public.ifund_ai_content_reserve(uuid,text) to authenticated;
grant execute on function public.ifund_ai_content_status() to authenticated;
