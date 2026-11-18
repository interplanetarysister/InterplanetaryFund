-- Ensure initial managed campaign drafts contain no creator-unapproved media or location metadata.
begin;
CREATE OR REPLACE FUNCTION public.ifund_creator_mandate_link_campaign(p_mandate_id uuid, p_campaign_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_mandate public.ifund_creator_mandates%rowtype;
  v_campaign public.ifund_campaigns%rowtype;
  v_goal numeric;
  v_profile public.ifund_managed_campaign_profiles%rowtype;
begin
  if v_actor is null
     or not coalesce(public.ifund_current_user_is_verified_super_admin(),false)
     or not coalesce(public.ifund_current_account_is_active(),false)
     or not coalesce(public.ifund_current_user_has_current_terms(),false) then
    raise exception 'Verified assigned IFund administrator required' using errcode='42501';
  end if;
  if p_mandate_id is null or p_campaign_id is null then
    raise exception 'Mandate and campaign references are required' using errcode='22023';
  end if;

  select * into v_mandate
  from public.ifund_creator_mandates m
  where m.id=p_mandate_id and m.assigned_admin_id=v_actor
  for update;
  if not found
     or v_mandate.status <> 'active'
     or v_mandate.expires_at <= statement_timestamp()
     or v_mandate.identity_verified_at is null
     or v_mandate.identity_verified_by is null
     or v_mandate.full_control_acknowledged is not true
     or v_mandate.ai_all_features_acknowledged is not true
     or v_mandate.creator_authority_confirmed is not true
     or v_mandate.creator_review_state <> 'approved'
     or v_mandate.creator_approved_at is null then
    raise exception 'Active verified mandate and exact creator-approved draft required' using errcode='42501';
  end if;

  if v_mandate.campaign_id is not null then
    if v_mandate.campaign_id = p_campaign_id then
      select * into v_profile from public.ifund_managed_campaign_profiles p
      where p.campaign_id=p_campaign_id;
      if found then
        return jsonb_build_object('linked',true,'campaign_id',p_campaign_id,'creator_name',v_profile.creator_name,'beneficiary_name',v_profile.beneficiary_name);
      end if;
    end if;
    raise exception 'This mandate is already linked to a campaign' using errcode='23505';
  end if;

  select * into v_campaign
  from public.ifund_campaigns c
  where c.id=p_campaign_id and c.owner_id=v_actor and c.status='draft'
  for update;
  if not found then
    raise exception 'A draft campaign owned by the assigned admin is required' using errcode='42501';
  end if;

  if jsonb_typeof(v_mandate.draft_payload) <> 'object'
     or coalesce(v_mandate.draft_payload->>'title','') <> v_campaign.title
     or coalesce(v_mandate.draft_payload->>'summary','') <> v_campaign.summary
     or coalesce(v_mandate.draft_payload->>'story','') <> v_campaign.story
     or coalesce(v_mandate.draft_payload->>'category','') <> v_campaign.category
     or not pg_catalog.pg_input_is_valid(v_mandate.draft_payload->>'goal_amount','numeric') then
    raise exception 'Campaign content does not match the creator-approved draft' using errcode='40001';
  end if;
  v_goal := (v_mandate.draft_payload->>'goal_amount')::numeric;
  if v_goal <= 0 or v_campaign.goal_amount <> v_goal then
    raise exception 'Campaign goal does not match the creator-approved draft' using errcode='40001';
  end if;

  if coalesce(v_campaign.cover_image_url,'') <> ''
     or v_campaign.map_opt_in is true
     or coalesce(v_campaign.public_location_label,'') <> ''
     or v_campaign.map_latitude is not null
     or v_campaign.map_longitude is not null then
    raise exception 'Managed campaign must start without unapproved imagery or public location data'
      using errcode='40001';
  end if;

  insert into public.ifund_managed_campaign_profiles (
    campaign_id,mandate_id,creator_name,beneficiary_name,fundraiser_label
  ) values (
    p_campaign_id,p_mandate_id,v_mandate.creator_name,v_mandate.beneficiary_name,v_mandate.fundraiser_label
  ) returning * into v_profile;

  update public.ifund_creator_mandates
  set campaign_id=p_campaign_id,updated_at=statement_timestamp()
  where id=p_mandate_id and assigned_admin_id=v_actor and campaign_id is null;
  if not found then
    raise exception 'Mandate campaign link changed concurrently' using errcode='40001';
  end if;

  insert into public.ifund_creator_mandate_events (
    mandate_id,actor_kind,actor_user_id,event_type,details
  ) values (
    p_mandate_id,'admin',v_actor,'campaign_linked',
    jsonb_build_object('campaign_id',p_campaign_id,'campaign_owner_id',v_actor,'creator_review_state','approved')
  );

  return jsonb_build_object(
    'linked',true,'campaign_id',p_campaign_id,
    'creator_name',v_profile.creator_name,
    'beneficiary_name',v_profile.beneficiary_name,
    'management_disclosure',v_profile.management_disclosure
  );
end
$function$
;
commit;
