begin;

-- The canonical client includes the opt-out Atlas fields in every campaign
-- payload. Hosted column-level privileges currently omit all four, so even
-- private draft saves are denied before owner RLS can evaluate the request.
-- Restore only these columns; do not broaden owner_id, server metadata, anon
-- access, row policies, constraints, provider permissions or media access.
do $migration$
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='ifund_campaigns'
      and c.relkind='r' and c.relrowsecurity
  ) then
    raise exception 'Campaign column grants require the existing RLS-protected campaign table';
  end if;
end
$migration$;

grant insert(map_opt_in,public_location_label,map_latitude,map_longitude)
  on public.ifund_campaigns to authenticated;
grant update(map_opt_in,public_location_label,map_latitude,map_longitude)
  on public.ifund_campaigns to authenticated;

commit;
