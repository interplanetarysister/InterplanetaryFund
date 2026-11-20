begin;
-- Owner-authorized resource bookmarks are tentative; neither a provider grant nor eligibility.
create unique index if not exists ifund_mission_catalog_bookmark_once
 on public.ifund_mission_opportunity_matches(mission_id,opportunity_id)
 where opportunity_id is not null;
create or replace function public.ifund_mission_bookmark_verified_resource(
 p_mission_id uuid,p_opportunity_id text
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 v_owner uuid:=auth.uid();
 v_resource public.ifund_opportunity%rowtype;
 v_link public.ifund_mission_opportunity_matches%rowtype;
 v_new uuid;
begin
 if v_owner is null
   or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
   or not exists(select 1 from auth.users where id=v_owner and email_confirmed_at is not null and is_anonymous is false)
   or not public.ifund_current_account_is_active()
   or not public.ifund_current_user_has_current_terms()
 then raise exception 'A confirmed active account and current terms are required' using errcode='42501';end if;
 if p_mission_id is null or p_opportunity_id is null or length(p_opportunity_id)>200
 then raise exception 'Invalid Mission or resource reference' using errcode='22023';end if;
 perform 1 from public.ifund_missions where id=p_mission_id and owner_id=v_owner;
 if not found then raise exception 'Private Mission not owned by member' using errcode='42501';end if;
 select * into v_resource from public.ifund_opportunity where id=p_opportunity_id
   and source_system='ifund_external_verified_v1' and verified_at is not null
   and official_url like 'https://%' and status in ('open','program');
 if not found then raise exception 'Reviewed resource link unavailable' using errcode='22023';end if;
 insert into public.ifund_mission_opportunity_matches
  (mission_id,owner_id,opportunity_id,source_url,provider_name,title,explanation,
   source_status,match_status,checked_at)
 values(p_mission_id,v_owner,v_resource.id,v_resource.official_url,
   left(coalesce(v_resource.official_provider,''),160),
   left(v_resource.title,240),
   'Owner bookmarked a possible resource. Eligibility and award are not verified.',
   'source_checked','interested',v_resource.verified_at)
 on conflict (mission_id,opportunity_id) where opportunity_id is not null do nothing
 returning id into v_new;
 if v_new is not null then
  insert into public.ifund_mission_events
   (mission_id,owner_id,event_key,actor_kind,event_type,safe_summary)
  values(p_mission_id,v_owner,gen_random_uuid(),'member','match_added',
    'Member saved a possible external resource for later review; eligibility unverified');
 end if;
 select * into v_link from public.ifund_mission_opportunity_matches
  where mission_id=p_mission_id and opportunity_id=p_opportunity_id and owner_id=v_owner;
 if not found or v_link.source_status<>'source_checked' or v_link.match_status<>'interested'
 then raise exception 'Bookmark status could not be verified' using errcode='42501';end if;
 return jsonb_build_object('id',v_link.id,'mission_id',v_link.mission_id,
   'opportunity_id',v_link.opportunity_id,'source_status',v_link.source_status,
   'match_status',v_link.match_status,'created_at',v_link.created_at,
   'already_saved',v_new is null);
end
$fn$;
revoke all on function public.ifund_mission_bookmark_verified_resource(uuid,text) from public,anon,authenticated;
grant execute on function public.ifund_mission_bookmark_verified_resource(uuid,text) to authenticated;
comment on function public.ifund_mission_bookmark_verified_resource(uuid,text)
 is 'Owner-bookmarked source-checked public link only; explicitly unverified eligibility, support or payments.';
commit;
