-- Explicit owner watches only; no new provider actions or inferred eligibility.
-- Reuse the same canonical freshness predicate as the public catalog.
CREATE OR REPLACE FUNCTION public.ifund_set_opportunity_watch(p_opportunity_id text, p_enabled boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare v_owner uuid:=auth.uid();v_exists boolean;
begin
 if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
   or not exists(select 1 from auth.users u where u.id=v_owner and u.email_confirmed_at is not null and u.is_anonymous is false)
 then raise exception 'Confirmed active account required' using errcode='42501'; end if;
 if p_opportunity_id is null or length(p_opportunity_id)>128 or p_enabled is null
 then raise exception 'Invalid watch request' using errcode='22023'; end if;
 if p_enabled then
   select exists(select 1 from public.ifund_opportunity o
     where o.id=p_opportunity_id and o.source_system='ifund_external_verified_v1'
 and o.verified_at is not null and o.verified_at<=now()
 and o.status in ('open','program')
 and o.verified_at>=now()-case when o.status='open' then interval '30 days' else interval '180 days' end
 and o.official_url ~ '^https://[^/@[:space:]]+([/:?#]|$)'
 and split_part(split_part(o.official_url,'/',3),'?',1) not like '%@%'
 and (o.deadline_at is null or o.deadline_at>now())
 and (o.deadline_date is null or o.deadline_date >= (now() at time zone 'UTC')::date)) into v_exists;
   if not v_exists then raise exception 'Verified opportunity not found' using errcode='22023'; end if;
   insert into public.ifund_opportunity_watches(owner_id,opportunity_id)
   values(v_owner,p_opportunity_id) on conflict do nothing;
 else
   delete from public.ifund_opportunity_watches
   where owner_id=v_owner and opportunity_id=p_opportunity_id;
 end if;
 return p_enabled;
end $function$;
create function ifund_ops.dispatch_watched_opportunity_deadlines(p_limit integer default 25)
returns integer language plpgsql volatile security invoker
set search_path='' set lock_timeout='3s' as $fn$
declare v_count integer;
begin
 if p_limit is null or p_limit not between 1 and 100 then
  raise exception 'Invalid deadline batch size' using errcode='22023';
 end if;
 with due as (
  select w.owner_id,o.id,o.title,d.deadline_label,d.stage,k.receipt
  from public.ifund_opportunity_watches w
  join public.ifund_opportunity o on o.id=w.opportunity_id
  join public.ifund_profiles p on p.id=w.owner_id
  join auth.users u on u.id=w.owner_id
  cross join lateral (select
   case when o.deadline_at is not null then
    to_char(o.deadline_at at time zone 'UTC','YYYY-MM-DD HH24:MI')||' UTC'
    else o.deadline_date::text||' (time not specified)' end deadline_label,
   case when o.deadline_at is not null then
    case when o.deadline_at<=now()+interval '24 hours' then '1d' else '7d' end
   else case when o.deadline_date<=(now() at time zone 'UTC')::date+1 then '1d' else '7d' end end stage,
   coalesce(extract(epoch from o.deadline_at)::text,o.deadline_date::text) identity
  ) d
  cross join lateral (select 'pulse:deadline:v1:'||md5(w.owner_id::text||':'||o.id||':'||d.identity||':'||d.stage) receipt) k
  where o.source_system='ifund_external_verified_v1'
 and o.verified_at is not null and o.verified_at<=now()
 and o.status in ('open','program')
 and o.verified_at>=now()-case when o.status='open' then interval '30 days' else interval '180 days' end
 and o.official_url ~ '^https://[^/@[:space:]]+([/:?#]|$)'
 and split_part(split_part(o.official_url,'/',3),'?',1) not like '%@%'
 and (o.deadline_at is null or o.deadline_at>now())
 and (o.deadline_date is null or o.deadline_date >= (now() at time zone 'UTC')::date)
   and p.account_status='active' and p.account_deletion_pending is false
   and u.email_confirmed_at is not null and u.is_anonymous is false
   and ((o.deadline_at is not null and o.deadline_at<=now()+interval '7 days')
     or (o.deadline_at is null and o.deadline_date>(now() at time zone 'UTC')::date
         and o.deadline_date<=(now() at time zone 'UTC')::date+7))
   and not exists(select 1 from public.ifund_notifications n where n.canonical_operation_id=k.receipt)
  order by coalesce(o.deadline_at,o.deadline_date::timestamp at time zone 'UTC'),w.owner_id,o.id
  limit p_limit for share of w,o,p,u skip locked
 )
 insert into public.ifund_notifications(owner_id,title,body,type,link,canonical_operation_id)
 select owner_id,'Watched funding deadline approaching',
   'The recorded deadline for '||left(coalesce(nullif(btrim(title),''),'your watched opportunity'),240)
   ||' is '||deadline_label||'. Review the official provider before applying. Eligibility and funding are not confirmed.',
   'system',case when id ~ '^[A-Za-z0-9_-]{1,128}$' then '/institutions/'||id else '/institutions' end,receipt
 from due on conflict(canonical_operation_id) where canonical_operation_id is not null do nothing;
 get diagnostics v_count=row_count;
 return v_count;
end $fn$;
revoke all on function ifund_ops.dispatch_watched_opportunity_deadlines(integer) from public,anon,authenticated,service_role;
grant execute on function ifund_ops.dispatch_watched_opportunity_deadlines(integer) to postgres;
do $verify$ begin
 if has_function_privilege('anon','ifund_ops.dispatch_watched_opportunity_deadlines(integer)','execute')
 or has_function_privilege('authenticated','ifund_ops.dispatch_watched_opportunity_deadlines(integer)','execute')
 or has_function_privilege('service_role','ifund_ops.dispatch_watched_opportunity_deadlines(integer)','execute')
 then raise exception 'Unexpected deadline dispatch privilege'; end if;
end $verify$;
