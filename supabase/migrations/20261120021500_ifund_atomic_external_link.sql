-- Atomic one-link creation. A single request either creates both group and
-- source, or creates neither. Duplicate canonical URLs reuse the existing source.
-- SECURITY INVOKER preserves the existing owner-scoped table RLS.
create or replace function public.ifund_link_external_fundraiser(
  p_platform text, p_campaign_url text, p_title text, p_group_id uuid default null
) returns table(source_id uuid, already_linked boolean)
language plpgsql security invoker set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_group uuid;
  v_source uuid;
begin
  if v_owner is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'verified_member_required' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.ifund_profiles p
    where p.id=v_owner and p.account_status='active'
      and p.account_deletion_pending=false
  ) then
    raise exception 'active_member_required' using errcode='42501';
  end if;
  if p_platform not in ('gofundme','givebutter','fundrazr')
      or p_campaign_url is null or length(p_campaign_url) > 2048
      or p_title is null or length(btrim(p_title)) not between 3 and 160 then
    raise exception 'invalid_campaign_reference' using errcode='22023';
  end if;
  -- Avoid duplicate parallel submissions creating empty groups.
  perform pg_advisory_xact_lock(hashtext(v_owner::text), hashtext(p_campaign_url));

  select s.id into v_source
    from public.ifund_external_fundraiser_sources s
   where s.owner_id=v_owner and s.campaign_url=p_campaign_url;
  if v_source is not null then
    source_id := v_source;
    already_linked := true;
    return next;
    return;
  end if;

  if p_group_id is not null then
    select g.id into v_group from public.ifund_external_fundraiser_groups g
     where g.id=p_group_id and g.owner_id=v_owner;
    if v_group is null then
      raise exception 'fundraiser_group_not_owned' using errcode='42501';
    end if;
  else
    insert into public.ifund_external_fundraiser_groups(owner_id,title)
      values (v_owner,btrim(p_title)) returning id into v_group;
  end if;

  insert into public.ifund_external_fundraiser_sources
    (owner_id,group_id,platform,campaign_url,currency,provenance)
    values (v_owner,v_group,p_platform,p_campaign_url,'USD','owner_reported')
    returning id into v_source;

  source_id := v_source;
  already_linked := false;
  return next;
end;
$$;
revoke all on function public.ifund_link_external_fundraiser(text,text,text,uuid) from public,anon;
grant execute on function public.ifund_link_external_fundraiser(text,text,text,uuid) to authenticated;
comment on function public.ifund_link_external_fundraiser(text,text,text,uuid)
  is 'Atomic, member-owned external campaign reference insertion; never a donation or verified host integration.';
