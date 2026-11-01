
create or replace function public.ifund_migration_my_campaigns()
returns table(
 owner_auth_uid uuid,source_id text,title text,summary text,story text,status text,
 category text,goal_amount numeric,cover_image_url text,end_date date,location text,source_updated_at text
)
language sql
stable
security definer
set search_path=''
as $function$
 select c.owner_auth_uid,c.legacy_id,c.title,c.summary,c.story,c.status,c.category,
        c.goal_amount,c.cover_image_url,
        case when c.end_date ~ '^\d{4}-\d{2}-\d{2}$' then c.end_date::date else null end,
        c.location,cs.source_payload->>'source_updated_at'
 from ifund_stage.campaign c
 join ifund_transfer.campaign_snapshots cs on cs.source_id=c.legacy_id
 join ifund_transfer.owner_identity_map m
   on m.source_owner_id=cs.source_payload->>'source_owner_id'
 where auth.uid() is not null
   and c.owner_auth_uid=auth.uid()
   and m.destination_auth_uid=auth.uid()
   and m.verification_state='verified'
   and cs.financial_authoritative is false
 order by c.legacy_id
 limit 50
$function$;

create or replace function public.ifund_migration_active_campaign_preview(
 p_after_source_id text default null,p_limit integer default 24
)
returns table(source_id text,title text,summary text,category text,cover_image_url text,preview_only boolean)
language sql
stable
security invoker
set search_path=''
as $function$
 select c.legacy_id,c.title,c.summary,c.category,c.cover_image_url,true
 from ifund_stage.campaign c
 join ifund_transfer.campaign_snapshots cs on cs.source_id=c.legacy_id
 where current_setting('request.jwt.claim.role',true)='service_role'
   and c.status='active'
   and cs.financial_authoritative is false
   and (p_after_source_id is null or c.legacy_id>p_after_source_id)
   and (p_after_source_id is null or length(p_after_source_id)<=128)
 order by c.legacy_id asc
 limit least(greatest(coalesce(p_limit,24),1),50)
$function$;

create or replace function public.ifund_migration_owner_lookup(p_source_owner_id text)
returns table(source_owner_id text,source_email text,verification_state text,destination_auth_uid uuid)
language sql
stable
security invoker
set search_path=''
as $function$
 select m.source_owner_id,m.source_email,m.verification_state,m.destination_auth_uid
 from ifund_transfer.owner_identity_map m
 where m.source_owner_id=p_source_owner_id
   and current_setting('request.jwt.claim.role',true)='service_role'
$function$;

create or replace function public.ifund_migration_owner_commit(
 p_source_owner_id text,p_destination_auth_uid uuid,p_expected_email text
)
returns table(linked boolean,source_owner_id text,destination_auth_uid uuid,verification_state text)
language plpgsql
security invoker
set search_path=''
as $function$
declare
 v_source_owner_id text;
 v_destination_auth_uid uuid;
 v_verification_state text;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
   raise exception 'forbidden' using errcode='42501';
 end if;
 if p_source_owner_id is null or length(p_source_owner_id)>128
    or p_expected_email is null or length(p_expected_email)>254 then
   raise exception 'invalid owner identity';
 end if;
 update ifund_transfer.owner_identity_map m
 set destination_auth_uid=p_destination_auth_uid,
     verification_state='verified',
     candidate_auth_uid=p_destination_auth_uid,
     candidate_match_method='confirmed_exact_email',
     candidate_detected_at=now(),
     updated_at=now()
 where m.source_owner_id=p_source_owner_id
   and m.verification_state='awaiting_destination_login'
   and m.destination_auth_uid is null
   and lower(btrim(m.source_email))=lower(btrim(p_expected_email))
   and exists(
     select 1 from auth.users u
     where u.id=p_destination_auth_uid
       and u.email_confirmed_at is not null
       and lower(btrim(u.email))=lower(btrim(p_expected_email))
   )
 returning m.source_owner_id,m.destination_auth_uid,m.verification_state
 into v_source_owner_id,v_destination_auth_uid,v_verification_state;
 if not found then
   return query select false,p_source_owner_id,p_destination_auth_uid,'awaiting_destination_login'::text;
   return;
 end if;

 update ifund_stage."user" u
 set owner_auth_uid=v_destination_auth_uid
 where u.legacy_id=v_source_owner_id;

 update ifund_stage.campaign c
 set owner_auth_uid=v_destination_auth_uid
 from ifund_transfer.campaign_snapshots cs
 where c.legacy_id=cs.source_id
   and cs.source_payload->>'source_owner_id'=v_source_owner_id;

 update ifund_stage.blog_entry b set owner_auth_uid=v_destination_auth_uid
 where b.owner_user_id=v_source_owner_id;
 update ifund_stage.notification n set owner_auth_uid=v_destination_auth_uid
 where n.user_id=v_source_owner_id;
 update ifund_stage.user_blog b set owner_auth_uid=v_destination_auth_uid
 where b.owner_user_id=v_source_owner_id;

 return query select true,v_source_owner_id,v_destination_auth_uid,v_verification_state;
end
$function$;

revoke all on function public.ifund_migration_my_campaigns() from public,anon;
revoke all on function public.ifund_migration_active_campaign_preview(text,integer) from public,anon,authenticated;
revoke all on function public.ifund_migration_owner_lookup(text) from public,anon,authenticated;
revoke all on function public.ifund_migration_owner_commit(text,uuid,text) from public,anon,authenticated;
grant execute on function public.ifund_migration_my_campaigns() to authenticated,service_role;
grant execute on function public.ifund_migration_active_campaign_preview(text,integer) to service_role;
grant execute on function public.ifund_migration_owner_lookup(text) to service_role;
grant execute on function public.ifund_migration_owner_commit(text,uuid,text) to service_role;
