-- Private, narrowly authorized funding-source observations. This is not
-- an opportunity verifier. Network reachability never extends verified_at.
create table ifund_ops.funding_source_probe_control(
 singleton boolean primary key default true check(singleton),
 secret_sha256 text not null check(secret_sha256 ~ '^[a-f0-9]{64}$'),
 enabled boolean not null default false
);
create table ifund_ops.funding_source_probe_state(
 source_id text primary key references public.ifund_funding_sources(id) on delete cascade,
 lease_id uuid, lease_until timestamptz, claimed_url text,
 last_checked_at timestamptz, last_status text check(last_status in ('review_required','failed')),
 last_http_status integer check(last_http_status between 100 and 599),
 last_sha256 text check(last_sha256 ~ '^[a-f0-9]{64}$'),
 last_url text,
 next_check_at timestamptz,
 check((lease_id is null and lease_until is null and claimed_url is null)
    or (lease_id is not null and lease_until is not null and claimed_url is not null))
);
alter table ifund_ops.funding_source_probe_control enable row level security;
alter table ifund_ops.funding_source_probe_state enable row level security;
revoke all on table ifund_ops.funding_source_probe_control,ifund_ops.funding_source_probe_state from public,anon,authenticated,service_role;
create function ifund_ops.funding_source_probe_allowed(p_id text,p_url text)
returns boolean language sql immutable strict set search_path='' as $fn$
 select (p_id,p_url) in (
 ('awesome-foundation','https://www.awesomefoundation.org/en/about_us'),
 ('mit-solve','https://solve.mit.edu/challenges'),
 ('usa-benefits','https://www.usa.gov/benefit-finder'))
$fn$;
revoke all on function ifund_ops.funding_source_probe_allowed(text,text) from public,anon,authenticated,service_role;
create function ifund_ops.require_funding_source_probe_key()
returns void language plpgsql stable security invoker set search_path='' as $fn$
declare k text;
begin
 k:=nullif(current_setting('request.headers',true),'')::jsonb->>'x-ifund-source-probe-key';
 if k is null or k !~ '^[a-f0-9]{64}$' or not exists(
 select 1 from ifund_ops.funding_source_probe_control c where c.singleton and c.enabled
 and c.secret_sha256=encode(sha256(convert_to(k,'UTF8')),'hex'))
 then raise exception 'Source monitor authorization required' using errcode='42501';end if;
end $fn$;
revoke all on function ifund_ops.require_funding_source_probe_key() from public,anon,authenticated,service_role;
create function public.ifund_claim_funding_source_probes(p_limit integer)
returns table(source_id text,official_url text,lease_id uuid)
language plpgsql volatile security definer set search_path='' set lock_timeout='3s' as $fn$
begin
 perform ifund_ops.require_funding_source_probe_key();
 if p_limit is null or p_limit not between 1 and 3 then raise exception 'Invalid probe batch' using errcode='22023';end if;
 insert into ifund_ops.funding_source_probe_state(source_id)
 select s.id from public.ifund_funding_sources s where s.approved and ifund_ops.funding_source_probe_allowed(s.id,s.official_url)
 on conflict on constraint funding_source_probe_state_pkey do nothing;
 return query with due as (
 select q.source_id,s.official_url from ifund_ops.funding_source_probe_state q
 join public.ifund_funding_sources s on s.id=q.source_id
 where s.approved and ifund_ops.funding_source_probe_allowed(s.id,s.official_url)
 and (q.lease_until is null or q.lease_until<=now())
 and (q.next_check_at is null or q.next_check_at<=now() or q.last_url is distinct from s.official_url)
 order by q.next_check_at nulls first,q.source_id limit p_limit for update of q,s skip locked
 ), claimed as (
 update ifund_ops.funding_source_probe_state q
 set lease_id=gen_random_uuid(),lease_until=now()+interval '15 minutes',claimed_url=d.official_url
 from due d where q.source_id=d.source_id returning q.source_id,q.claimed_url,q.lease_id
 ) select c.source_id,c.claimed_url,c.lease_id from claimed c;
end $fn$;
revoke all on function public.ifund_claim_funding_source_probes(integer) from public,anon,authenticated,service_role;
grant execute on function public.ifund_claim_funding_source_probes(integer) to anon;
create function public.ifund_complete_funding_source_probe(p_source_id text,p_lease_id uuid,p_status text,p_http_status integer,p_sha256 text)
returns boolean language plpgsql volatile security definer set search_path='' set lock_timeout='3s' as $fn$
declare q ifund_ops.funding_source_probe_state%rowtype; s public.ifund_funding_sources%rowtype; changed boolean; next_at timestamptz;
begin
 perform ifund_ops.require_funding_source_probe_key();
 if p_status not in ('review_required','failed') or p_status is null or p_lease_id is null
 or (p_http_status is not null and p_http_status not between 100 and 599)
 or (p_status='review_required' and (p_http_status is distinct from 200 or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$'))
 or (p_status='failed' and p_sha256 is not null)
 then raise exception 'Invalid probe receipt' using errcode='22023';end if;
 select * into q from ifund_ops.funding_source_probe_state where source_id=p_source_id for update;
 if not found or q.lease_id is distinct from p_lease_id or q.lease_until<=now() then return false;end if;
 select * into s from public.ifund_funding_sources where id=p_source_id for update;
 if not found or not s.approved or s.official_url is distinct from q.claimed_url or not ifund_ops.funding_source_probe_allowed(s.id,s.official_url) then return false;end if;
 changed:=q.last_sha256 is distinct from p_sha256 or q.last_url is distinct from s.official_url;
 next_at:=now()+make_interval(hours=>case when p_status='failed' then least(s.refresh_hours,6) else s.refresh_hours end);
 update ifund_ops.funding_source_probe_state set lease_id=null,lease_until=null,claimed_url=null,
 last_checked_at=now(),last_status=p_status,last_http_status=p_http_status,
 last_sha256=case when p_status='review_required' then p_sha256 else last_sha256 end,
 last_url=s.official_url,next_check_at=next_at where source_id=s.id;
 update public.ifund_funding_sources set last_checked_at=now(),next_check_at=next_at,refresh_status=p_status where id=s.id;
 -- The existing source invalidation trigger handles failed checks. A new
 -- fingerprint also requires review, but neither case changes verified_at.
 if p_status='review_required' and changed then
 update public.ifund_opportunity set requirements_status='needs_review',requirements_complete=false,
 requirement_version=requirement_version+1 where funding_source_id=s.id and requirements_status='verified';
 end if;
 return true;
end $fn$;
revoke all on function public.ifund_complete_funding_source_probe(text,uuid,text,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.ifund_complete_funding_source_probe(text,uuid,text,integer,text) to anon;
do $verify$ begin
 if has_table_privilege('anon','ifund_ops.funding_source_probe_control','select')
 or has_table_privilege('authenticated','ifund_ops.funding_source_probe_state','select')
 or has_function_privilege('authenticated','public.ifund_claim_funding_source_probes(integer)','execute')
 or has_function_privilege('authenticated','public.ifund_complete_funding_source_probe(text,uuid,text,integer,text)','execute')
 then raise exception 'Source probe isolation failure';end if;
end $verify$;
