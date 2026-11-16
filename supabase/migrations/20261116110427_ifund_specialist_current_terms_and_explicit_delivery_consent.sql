BEGIN;
-- Source reconciliation only. Preserve historical DDL; apply only after catalog review.
-- Current terms and explicit outreach consent never derive from legacy default preferences.
DO $preflight$ BEGIN
 IF to_regprocedure('public.ifund_current_user_has_current_terms()') IS NULL
  OR to_regclass('public.ifund_marketing_consent') IS NULL THEN
  RAISE EXCEPTION 'Current legal and explicit marketing consent contracts are required';
 END IF;
END $preflight$;

create or replace function ifund_strategy_runtime.require_member() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();
begin
 if v_uid is null or not exists(select 1 from auth.users u join public.ifund_profiles p on p.id=u.id where u.id=v_uid and u.email_confirmed_at is not null and u.is_anonymous is false and p.account_status='active' and p.account_deletion_pending is false) then raise exception 'Member access required' using errcode='42501'; end if;
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
 if v_uid is null or not exists(select 1 from auth.users u join public.ifund_profiles p on p.id=u.id where u.id=v_uid and u.email_confirmed_at is not null and u.is_anonymous is false and p.account_status='active' and p.account_deletion_pending is false) then raise exception 'Member access required' using errcode='42501'; end if;
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
 if v_uid is null or not exists(select 1 from auth.users u join public.ifund_profiles p on p.id=u.id where u.id=v_uid and u.email_confirmed_at is not null and u.is_anonymous is false and p.account_status='active' and p.account_deletion_pending is false) or not coalesce(public.ifund_current_user_has_current_terms(),false) then raise exception 'Member access required' using errcode='42501';end if;
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
 if v_uid is null or not exists(select 1 from auth.users u join public.ifund_profiles p on p.id=u.id where u.id=v_uid and u.email_confirmed_at is not null and u.is_anonymous is false and p.account_status='active' and p.account_deletion_pending is false) or not coalesce(public.ifund_current_user_has_current_terms(),false) then raise exception 'Member access required' using errcode='42501';end if;
 if p_action and coalesce((ifund_story_runtime.subscription()->>'level')::integer,0)<2 then raise exception 'Managed Connections plan required' using errcode='42501';end if;
 return v_uid;
end $$;
revoke all on function ifund_connections_runtime.require_member(boolean) from public,anon;
grant execute on function ifund_connections_runtime.require_member(boolean) to authenticated;

create or replace function ifund_communications_runtime.eligible_recipients(p_campaign_id uuid,p_snapshot uuid[] default null) returns setof uuid
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=ifund_communications_runtime.require_member();
begin
 if not exists(select 1 from public.ifund_campaigns where id=p_campaign_id and owner_id=v_uid) then raise exception 'Owned campaign required' using errcode='42501';end if;
 return query select distinct d.donor_id from public.ifund_donations d join public.ifund_profiles p on p.id=d.donor_id join auth.users u on u.id=p.id join public.ifund_marketing_consent consent on consent.owner_id=p.id
 where d.campaign_id=p_campaign_id and d.status='captured' and d.paypal_capture_id is not null and d.captured_at is not null and d.donor_id<>v_uid
 and consent.outreach_opt_in is true and consent.consented_at is not null and u.is_anonymous is false and u.email_confirmed_at is not null and p.account_status='active' and p.account_deletion_pending is false and p.comm_prefs->'in_app_updates'='true'::jsonb
 and(p_snapshot is null or d.donor_id=any(p_snapshot));
end $$;
revoke all on function ifund_communications_runtime.eligible_recipients(uuid,uuid[]) from public,anon;
grant execute on function ifund_communications_runtime.eligible_recipients(uuid,uuid[]) to authenticated;

create or replace function public.ifund_communications_delivery_contract()
returns integer language sql stable security invoker set search_path='' as $$
 select case when auth.uid() is not null then 2 else 0 end;
$$;
revoke all on function public.ifund_communications_delivery_contract() from public,anon;
grant execute on function public.ifund_communications_delivery_contract() to authenticated;
COMMIT;
