begin;
CREATE OR REPLACE FUNCTION public.ifund_mission_link_owned_campaign(p_mission_id uuid, p_campaign_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_owner uuid := auth.uid();
v_campaign public.ifund_campaigns%rowtype;
v_mission public.ifund_missions%rowtype;
v_link public.ifund_mission_campaign_links%rowtype;
begin
 if v_owner is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
    or not public.ifund_current_account_is_active()
    or not public.ifund_current_user_has_current_terms()
 then raise exception 'Verified account and current terms required' using errcode='42501';end if;
 if p_mission_id is null or p_campaign_id is null
 then raise exception 'Mission and campaign IDs required' using errcode='22023';end if;
 select * into v_mission from public.ifund_missions where id=p_mission_id and owner_id=v_owner;
 if not found then raise exception 'Private Mission not found for owner' using errcode='42501';end if;
 select * into v_campaign from public.ifund_campaigns where id=p_campaign_id and owner_id=v_owner;
 if not found then raise exception 'Campaign not found for owner' using errcode='42501';end if;
 insert into public.ifund_mission_campaign_links(mission_id,owner_id,campaign_id)
 values(p_mission_id,v_owner,p_campaign_id)
 on conflict (mission_id,campaign_id) do nothing;
 select * into v_link from public.ifund_mission_campaign_links
 where mission_id=p_mission_id and campaign_id=p_campaign_id and owner_id=v_owner;
 if not found then raise exception 'Campaign is already linked elsewhere' using errcode='23505';end if;
 return jsonb_build_object('id',v_link.id,'mission_id',v_link.mission_id,
   'campaign_id',v_link.campaign_id,'linked_at',v_link.linked_at);
end
$function$;
revoke all on function public.ifund_mission_link_owned_campaign(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ifund_mission_link_owned_campaign(uuid,uuid) to authenticated;
comment on function public.ifund_mission_link_owned_campaign(uuid,uuid) is 'Link only the authenticated owner’s preexisting Mission and campaign; does not publish, charge or transfer funds.';
commit;
