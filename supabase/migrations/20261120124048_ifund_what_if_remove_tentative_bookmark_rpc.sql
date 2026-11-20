begin;
create or replace function public.ifund_mission_remove_tentative_resource(
 p_mission_id uuid,p_opportunity_id text
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 v_owner uuid:=auth.uid();
 v_deleted uuid;
 v_protected boolean:=false;
begin
 if v_owner is null
  or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
  or not exists(select 1 from auth.users where id=v_owner
    and email_confirmed_at is not null and is_anonymous is false)
  or not public.ifund_current_account_is_active()
  or not public.ifund_current_user_has_current_terms()
 then raise exception 'A confirmed active member and current terms are required'
  using errcode='42501';end if;
 if p_mission_id is null or p_opportunity_id is null
  or length(p_opportunity_id)>200 or length(btrim(p_opportunity_id))=0
 then raise exception 'Invalid Mission or resource reference' using errcode='22023';end if;
 perform 1 from public.ifund_missions
  where id=p_mission_id and owner_id=v_owner;
 if not found then raise exception 'Private Mission not owned by member' using errcode='42501';end if;
 -- Only a tentative, uncommitted bookmark can be removed. Records that have
 -- progressed to applications, confirmed offers, or provider evidence remain.
 select exists(
  select 1 from public.ifund_mission_opportunity_matches
  where mission_id=p_mission_id and owner_id=v_owner
   and opportunity_id=p_opportunity_id
   and (match_status<>'interested' or source_status<>'source_checked')
 ) into v_protected;
 if v_protected then
  raise exception 'This resource has progressed beyond a bookmark'
   using errcode='42501';
 end if;
 delete from public.ifund_mission_opportunity_matches
 where mission_id=p_mission_id and owner_id=v_owner
  and opportunity_id=p_opportunity_id
  and match_status='interested' and source_status='source_checked'
 returning id into v_deleted;
 if v_deleted is not null then
  insert into public.ifund_mission_events
    (mission_id,owner_id,event_key,actor_kind,event_type,safe_summary)
  values (p_mission_id,v_owner,gen_random_uuid(),'member','updated',
   'Member removed a tentative external resource bookmark');
 end if;
 return jsonb_build_object(
  'mission_id',p_mission_id,'opportunity_id',p_opportunity_id,
  'removed',v_deleted is not null,'already_absent',v_deleted is null
 );
end
$fn$;
revoke all on function public.ifund_mission_remove_tentative_resource(uuid,text) from public,anon,authenticated;
grant execute on function public.ifund_mission_remove_tentative_resource(uuid,text) to authenticated;
comment on function public.ifund_mission_remove_tentative_resource(uuid,text)
 is 'Owner-only delete of tentative source-checked bookmark; irreversible submitted or provider-confirmed states cannot be deleted here.';
commit;
