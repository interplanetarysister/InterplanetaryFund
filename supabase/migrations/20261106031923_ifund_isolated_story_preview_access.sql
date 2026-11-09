begin;
-- Preview acceptance must not require enabling the shared production Story gate.
-- The existing executor digest establishes the channel. An environment label,
-- member JWT alone, production key or expired evidence cannot grant preview.
create or replace function ifund_workforce_runtime.story_preview_enabled()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    auth.uid() is not null
    and ifund_workforce_runtime.channel() = 'preview'
    and exists(select 1 from ifund_story_runtime.control where singleton)
    and exists(select 1 from ifund_ops.workforce_control c
      where c.singleton and c.preview_enabled
        and c.free_plan_verified_until > now()
        and coalesce(length(c.free_plan_evidence),0) > 0),
    false)
$$;
revoke all on function ifund_workforce_runtime.story_preview_enabled()
  from public,anon,authenticated;

-- Retain every existing identity, agreement and entitlement check. Only the
-- disabled-service branch accepts the independently authenticated preview.
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
    where u.id=v_uid and u.email_confirmed_at is not null
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
-- Preserve the existing definer owner and the helper's private access.
-- No table, browser privilege, control flag, quota or user record is changed.
commit;
