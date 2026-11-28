begin;
-- Owner directive 2026-11-27: account (email) verification is required for
-- withdrawals/payouts only. It must NOT gate the agent features: team chat
-- (REACH/NEXUS/specialists), Story Forge, the AI Campaign Coach (strategy),
-- growth, communications, managed connections, and Refine Knowledge.
--
-- The requirement lived in one shared predicate repeated across the agent
-- domains' member guards: `u.email_confirmed_at is not null`. This
-- migration redefines ONLY those guards with that single condition
-- removed. Every other condition is preserved verbatim from each guard's
-- latest definition:
--   * anonymous sessions are still rejected;
--   * the profile must still be account_status='active' and not
--     deletion-pending;
--   * current-legal-terms acceptance is still required where it was;
--   * subscription tier checks are untouched: ifund_story_runtime
--     .subscription() computes tiers exactly as before (a free member
--     still reads level 0, so Refine Knowledge's subscriber gate and the
--     specialists' plan-level checks still fail closed). Only its
--     identity precondition changes, so an unconfirmed SUBSCRIBER now
--     reads their real tier instead of an exception.
--   * recipient-side eligibility (who may RECEIVE outreach) is untouched;
--   * withdrawal/payout functions (public
--     .ifund_connect_paypal_payout_to_verified_email,
--     ifund_internal_prepare_paypal_payout, the deferred-withdrawal MFA
--     contracts) keep their verified-email requirement exactly as-is.
-- Historical error-message strings are preserved verbatim, including the
-- ones that still say "Verified"/"Confirmed": only the predicate changed.
--
-- Source-only per the repo's migration discipline: reviewed here, applied
-- to production separately under the owner's standing authorization.
do $preflight$ begin
  if to_regprocedure('public.ifund_team_member_id()') is null
    or to_regprocedure('ifund_story_runtime.subscription()') is null
    or to_regprocedure('ifund_story_runtime.require_member()') is null
    or to_regprocedure('ifund_strategy_runtime.require_member()') is null
    or to_regprocedure('ifund_growth_runtime.require_member()') is null
    or to_regprocedure('ifund_communications_runtime.require_member(boolean,boolean)') is null
    or to_regprocedure('ifund_connections_runtime.require_member(boolean)') is null
    or to_regprocedure('ifund_workforce_runtime.queued()') is null
    or to_regprocedure('ifund_workforce_runtime.cancel_queued(uuid)') is null
  then raise exception 'Agent member-guard contracts are required before this migration'; end if;
end $preflight$;

-- 1. Team context guard (team chat / REACH / NEXUS / specialists history).
-- Latest definition: 20261115094500_ifund_shared_agent_team_events.sql.
create or replace function public.ifund_team_member_id() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
    or not exists (select 1 from auth.users u join public.ifund_profiles p on p.id=u.id
      where u.id=actor and p.account_status='active'
      and p.account_deletion_pending is false)
  then raise exception 'Verified member required' using errcode='42501'; end if;
  return actor;
end $$;
revoke all on function public.ifund_team_member_id() from public,anon,authenticated;

-- 2. Tier read. Latest definition:
-- 20261120194050_ifund_agent_trial_referrals_20261120.sql. Entitlement and
-- trial logic byte-identical; only the identity precondition loses the
-- email-confirmation condition.
create or replace function ifund_story_runtime.subscription() returns jsonb
language plpgsql stable security definer set search_path='' as $fn$
declare
 v_uid uuid:=auth.uid();
 v_entitlement ifund_access.member_entitlements%rowtype;
 v_tier text:='free'; v_status text:='inactive'; v_level integer:=0;
begin
 if v_uid is null or not exists(
  select 1 from auth.users u join public.ifund_profiles p on p.id=u.id
  where u.id=v_uid
  and p.account_status='active' and p.account_deletion_pending is false
 ) then raise exception 'Member access required' using errcode='42501'; end if;
 if public.ifund_current_user_is_verified_admin() is true then
  return jsonb_build_object('tier','enterprise','level',4,'status','active','active',true,'admin_granted',true);
 end if;
 select * into v_entitlement from ifund_access.member_entitlements
 where owner_id=v_uid and verified_at<=now() and valid_until>now();
 if found then
  if v_entitlement.status='active' or
      (v_entitlement.status='trialing' and v_entitlement.trial_end>now()) then
    v_tier:=v_entitlement.tier;v_status:=v_entitlement.status;
  elsif v_entitlement.day_pass_expires_at>now() then
    v_tier:='basic';v_status:='day_pass';
  end if;
 end if;
 if v_tier='free' and exists (
  select 1 from public.ifund_referral_trial_accounts t
  join public.ifund_agent_trial_control c on c.singleton=true and c.enabled=true
  where t.owner_id=v_uid and t.trial_started_at is not null
   and t.trial_expires_at>now()
 ) then v_tier:='basic';v_status:='trialing'; end if;
 v_level:=case v_tier when 'basic' then 1 when 'outreach' then 2
   when 'nonprofit' then 2 when 'professional' then 3
   when 'enterprise' then 4 else 0 end;
 return jsonb_build_object('tier',v_tier,'level',v_level,
   'status',v_status,'active',v_level>0,'admin_granted',false);
end $fn$;
revoke all on function ifund_story_runtime.subscription() from public,anon,authenticated;
grant execute on function ifund_story_runtime.subscription() to authenticated;

-- 3. Story Forge guard. Latest definition:
-- 20261106031923_ifund_isolated_story_preview_access.sql (preview branch,
-- legal acceptance and plan-level checks preserved).
create or replace function ifund_story_runtime.require_member() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if not exists(select 1 from ifund_story_runtime.control where enabled is true)
    and not ifund_workforce_runtime.story_preview_enabled() then
    raise exception 'Story preview disabled' using errcode='42501';
  end if;
  if v_uid is null or not exists (
    select 1 from auth.users u join public.ifund_profiles p on p.id=u.id
    where u.id=v_uid
      and p.account_status='active' and p.account_deletion_pending is false
  ) or not exists (
    select 1 from public.ifund_legal_acceptances l where l.owner_id=v_uid
      and l.terms_version='2026-10-13-v3' and l.explicit_consent is true
  ) then raise exception 'Member access required' using errcode='42501'; end if;
  if coalesce((ifund_story_runtime.subscription()->>'level')::integer,0)<1 then
    raise exception 'Eligible AI plan required' using errcode='42501';
  end if;
  return v_uid;
end $$;
revoke all on function ifund_story_runtime.require_member()
  from public,anon,authenticated;

-- 4-7. Specialist guards. Latest definitions:
-- 20261116110427_ifund_specialist_current_terms_and_explicit_delivery_consent.sql
-- (current-terms and plan-level checks preserved).
create or replace function ifund_strategy_runtime.require_member() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();
begin
 if v_uid is null or not exists(select 1 from auth.users u join public.ifund_profiles p on p.id=u.id where u.id=v_uid and u.is_anonymous is false and p.account_status='active' and p.account_deletion_pending is false) then raise exception 'Member access required' using errcode='42501'; end if;
  if not exists(select 1 from ifund_strategy_runtime.control where enabled) then raise exception 'Strategy disabled' using errcode='42501'; end if;
  -- Reuse the canonical verified entitlement calculation, not Story's switch.
  if coalesce((ifund_story_runtime.subscription()->>'level')::integer,0)<1
    or not coalesce(public.ifund_current_user_has_current_terms(),false)
  then raise exception 'Member access required' using errcode='42501'; end if;
  return v_uid;
end $$;
revoke all on function ifund_strategy_runtime.require_member() from public,anon;
grant execute on function ifund_strategy_runtime.require_member() to authenticated;

create or replace function ifund_growth_runtime.require_member() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();
begin
 if v_uid is null or not exists(select 1 from auth.users u join public.ifund_profiles p on p.id=u.id where u.id=v_uid and u.is_anonymous is false and p.account_status='active' and p.account_deletion_pending is false) then raise exception 'Member access required' using errcode='42501'; end if;
  if not exists(select 1 from ifund_growth_runtime.control where enabled) then raise exception 'Growth disabled' using errcode='42501'; end if;
  -- Reuse the canonical verified entitlement calculation, not Story's switch.
  if coalesce((ifund_story_runtime.subscription()->>'level')::integer,0)<1
    or not coalesce(public.ifund_current_user_has_current_terms(),false)
  then raise exception 'Member access required' using errcode='42501'; end if;
  return v_uid;
end $$;
revoke all on function ifund_growth_runtime.require_member() from public,anon;
grant execute on function ifund_growth_runtime.require_member() to authenticated;

create or replace function ifund_communications_runtime.require_member(p_delivery boolean default false,p_ai boolean default false) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();
begin
 if not exists(select 1 from ifund_communications_runtime.control where enabled and (not p_delivery or delivery_enabled)) then raise exception 'Communications unavailable' using errcode='42501';end if;
 if v_uid is null or not exists(select 1 from auth.users u join public.ifund_profiles p on p.id=u.id where u.id=v_uid and u.is_anonymous is false and p.account_status='active' and p.account_deletion_pending is false) or not coalesce(public.ifund_current_user_has_current_terms(),false) then raise exception 'Member access required' using errcode='42501';end if;
 if p_ai and coalesce((ifund_story_runtime.subscription()->>'level')::int,0)<1 then raise exception 'Eligible AI plan required' using errcode='42501';end if;
 return v_uid;
end $$;
revoke all on function ifund_communications_runtime.require_member(boolean,boolean) from public,anon;
grant execute on function ifund_communications_runtime.require_member(boolean,boolean) to authenticated;

create or replace function ifund_connections_runtime.require_member(p_action boolean default false) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();
begin
 if not exists(select 1 from ifund_connections_runtime.control where enabled) then raise exception 'Connections unavailable' using errcode='42501';end if;
 if v_uid is null or not exists(select 1 from auth.users u join public.ifund_profiles p on p.id=u.id where u.id=v_uid and u.is_anonymous is false and p.account_status='active' and p.account_deletion_pending is false) or not coalesce(public.ifund_current_user_has_current_terms(),false) then raise exception 'Member access required' using errcode='42501';end if;
 if p_action and coalesce((ifund_story_runtime.subscription()->>'level')::integer,0)<2 then raise exception 'Managed Connections plan required' using errcode='42501';end if;
 return v_uid;
end $$;
revoke all on function ifund_connections_runtime.require_member(boolean) from public,anon;
grant execute on function ifund_connections_runtime.require_member(boolean) to authenticated;

-- 8-9. Story workforce member-facing queue reads/cancels. Latest
-- definitions: 20261104062233_ifund_preview_workforce_isolation.sql
-- (queued) and 20261104055345_ifund_collective_workforce.sql
-- (cancel_queued). The executor-side require_worker() check is a service
-- credential check, not member identity, and is untouched.
create or replace function ifund_workforce_runtime.queued() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or not exists(select 1 from auth.users where id=actor) then raise exception 'Confirmed owner required' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('request_id',split_part(j.source_event_id,':',2),'campaign_id',j.payload->'campaign_id','environment',coalesce(j.payload->>'environment','production'),'task',j.payload->'task','retry_after',j.run_after,
    'can_resume',((j.payload->>'campaign_id') is null or exists(select 1 from public.ifund_campaigns c where c.id::text=j.payload->>'campaign_id' and c.owner_id=actor))) order by j.created_at),'[]'::jsonb)
    from ifund_ops.workflow_jobs j where j.owner_id=actor and j.workflow_key='story_agent_v1' and j.status='paused' and j.payload->>'queue_owner'='workforce_v1');
end $$;
revoke all on function ifund_workforce_runtime.queued() from public,anon,authenticated;
grant execute on function ifund_workforce_runtime.queued() to authenticated;

create or replace function ifund_workforce_runtime.cancel_queued(p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); job ifund_ops.workflow_jobs%rowtype;
begin
  if actor is null or not exists(select 1 from auth.users where id=actor) then raise exception 'Confirmed owner required' using errcode='42501'; end if;
  select * into job from ifund_ops.workflow_jobs where workflow_key='story_agent_v1' and source_event_id=actor::text||':'||p_request_id::text and owner_id=actor and payload->>'queue_owner'='workforce_v1' for update;
  if not found or job.status not in ('paused','cancelled') then raise exception 'Queued request unavailable' using errcode='42501'; end if;
  update ifund_ops.workflow_jobs set status='cancelled',payload=payload-'task',last_error=null,updated_at=now() where id=job.id;
  return jsonb_build_object('status','cancelled','request_id',p_request_id);
end $$;
revoke all on function ifund_workforce_runtime.cancel_queued(uuid) from public,anon,authenticated;
grant execute on function ifund_workforce_runtime.cancel_queued(uuid) to authenticated;
commit;
