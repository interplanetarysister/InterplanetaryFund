-- Notify explicitly watching verified active members of real source changes.
-- A lost or expired source is an unavailability notice, never an application recommendation.
create or replace function public.ifund_opportunity_watch_source_update()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare w record; v_key text; v_old boolean; v_new boolean; v_material boolean;
begin
 v_old:=coalesce(old.source_system='ifund_external_verified_v1'
 and old.verified_at is not null and old.verified_at<=now()
 and old.status in ('open','program')
 and old.verified_at>=now()-case when old.status='open' then interval '30 days' else interval '180 days' end
 and old.official_url ~ '^https://[^/@[:space:]]+([/:?#]|$)'
 and split_part(split_part(old.official_url,'/',3),'?',1) not like '%@%'
 and (old.deadline_at is null or old.deadline_at>now())
 and (old.deadline_date is null or old.deadline_date >= (now() at time zone 'UTC')::date),false);
 v_new:=coalesce(new.source_system='ifund_external_verified_v1'
 and new.verified_at is not null and new.verified_at<=now()
 and new.status in ('open','program')
 and new.verified_at>=now()-case when new.status='open' then interval '30 days' else interval '180 days' end
 and new.official_url ~ '^https://[^/@[:space:]]+([/:?#]|$)'
 and split_part(split_part(new.official_url,'/',3),'?',1) not like '%@%'
 and (new.deadline_at is null or new.deadline_at>now())
 and (new.deadline_date is null or new.deadline_date >= (now() at time zone 'UTC')::date),false);
 v_material:=(old.deadline_date,old.status,old.requirement_version,old.deadline_at,old.official_url)
  is distinct from (new.deadline_date,new.status,new.requirement_version,new.deadline_at,new.official_url);
 if not (v_old or v_new) or (v_old=v_new and not v_material) then return new;end if;
 for w in select x.owner_id from public.ifund_opportunity_watches x
 join public.ifund_profiles p on p.id=x.owner_id
 join auth.users u on u.id=x.owner_id
 where x.opportunity_id=new.id and p.account_status='active' and p.account_deletion_pending is false
 and u.email_confirmed_at is not null and u.is_anonymous is false
 loop
  v_key:='pulse:funding:v2:'||md5(new.id||':'||w.owner_id::text||':'||new.requirement_version::text||':'||v_new::text||':'||txid_current()::text);
  insert into public.ifund_notifications(owner_id,title,body,type,link,canonical_operation_id)
  values(w.owner_id,case when v_new then 'Funding requirements changed' else 'Watched funding source unavailable' end,
    case when v_new then 'Review the updated official source, requirements and deadline in iFund. Eligibility and funding are not confirmed.'
    else 'The watched source is no longer current or available in the verified catalog. Do not rely on the previous requirements or deadline.' end,
    'system',case when v_new and new.id ~ '^[A-Za-z0-9_-]{1,128}$' then '/institutions/'||new.id else '/institutions' end,v_key)
  on conflict do nothing;
 end loop;
 return new;
end $fn$;
revoke all on function public.ifund_opportunity_watch_source_update() from public,anon,authenticated;
create or replace trigger ifund_opportunity_watch_change_trigger
after update of deadline_date,status,requirement_version,deadline_at,official_url,verified_at,source_system
on public.ifund_opportunity for each row execute function public.ifund_opportunity_watch_source_update();
