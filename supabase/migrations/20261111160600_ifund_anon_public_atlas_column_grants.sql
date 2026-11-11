-- Public Atlas reads exactly the four organizer-approved coarse location fields.
-- Existing anonymous SELECT is column-scoped and RLS only exposes active campaigns.
-- Never grant whole-table SELECT or expose owner_id/private drafts.
begin;
grant select (map_opt_in,public_location_label,map_latitude,map_longitude)
  on table public.ifund_campaigns to anon;
comment on column public.ifund_campaigns.map_opt_in is
  'Explicit owner opt-in for publicly visible, coarse campaign Atlas placement (RLS only active rows).';
commit;
