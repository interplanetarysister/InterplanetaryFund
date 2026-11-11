-- Opt-in approximate campaign locations and owner-only actual agent activity statistics.
-- No changes to PayPal payment/receipt tables. Demo records remain isolated.
begin;
alter table public.ifund_campaigns
  add column if not exists map_opt_in boolean not null default false,
  add column if not exists public_location_label text,
  add column if not exists map_latitude numeric(3,1),
  add column if not exists map_longitude numeric(4,1);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ifund_campaigns_approximate_map_location_check'
      and conrelid = 'public.ifund_campaigns'::regclass
  ) then
    alter table public.ifund_campaigns add constraint ifund_campaigns_approximate_map_location_check
      check (
        (map_opt_in = false and map_latitude is null and map_longitude is null and public_location_label is null)
        or
        (map_opt_in = true and map_latitude between -90 and 90 and map_longitude between -180 and 180
          and public_location_label is not null
          and length(btrim(public_location_label)) between 2 and 80)
      );
  end if;
end $$;
comment on column public.ifund_campaigns.map_opt_in is 'Explicit public Atlas opt-in; disabled by default; coordinates must never be secretly stored.';
comment on column public.ifund_campaigns.map_latitude is 'Approximate 0.1 degree latitude only; no precise home address or device location.';
comment on column public.ifund_campaigns.map_longitude is 'Approximate 0.1 degree longitude only; no precise home address or device location.';
comment on column public.ifund_campaigns.public_location_label is 'Opt-in approximate public city/region name; visible for active campaigns.';

-- RLS on ifund_campaigns already restricts writes to authenticated campaign owners.
-- The caller must hold an authenticated Supabase identity and own the requested campaign.
-- Raw agent activity and descriptions are never publicly revealed.
create or replace function public.ifund_owner_campaign_agent_focus(p_campaign_id uuid)
returns table(category text, status text, activity_count bigint)
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or
    not exists (
      select 1 from public.ifund_campaigns c
       where c.id = p_campaign_id and c.owner_id = auth.uid()
         and public.ifund_current_account_is_active()
    ) then
    raise exception 'Campaign not found for this owner' using errcode = '42501';
  end if;
  return query
  select coalesce(a.category, 'other'), coalesce(a.status,'unknown'), count(*)::bigint
    from public.ifund_agent_activity a
    where a.campaign_id = p_campaign_id::text
    group by a.category,a.status order by a.category,a.status;
end $$;
revoke all on function public.ifund_owner_campaign_agent_focus(uuid) from public,anon;
grant execute on function public.ifund_owner_campaign_agent_focus(uuid) to authenticated;
comment on function public.ifund_owner_campaign_agent_focus(uuid) is
'Owner-only aggregate counts of actual stored agent activity by category/status. Counts are not effort/time/fundraising money.';
commit;
