begin;
-- Read-only verified-source catalog for private What If Missions.
-- No anonymous grants, no write grants and no eligibility claims.
do $guard$
begin
 if not exists (
  select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='ifund_opportunity' and c.relrowsecurity is true
 ) then raise exception 'Opportunity table requires RLS'; end if;
 if not exists (
  select 1 from pg_policies
  where schemaname='public' and tablename='ifund_opportunity'
    and policyname='ifund_external_verified_opportunity_public' and cmd='SELECT'
    and qual like '%source_system%' and qual like '%verified_at%'
 ) then raise exception 'Verified-source row policy missing'; end if;
end $guard$;
grant select (
 id,title,type,description,official_url,official_provider,verified_at,
 cause_tags,geography,requirements_complete,deadline_at,source_system,status
) on public.ifund_opportunity to authenticated;
commit;
