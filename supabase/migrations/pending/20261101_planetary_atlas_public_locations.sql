-- Pending review: do not apply to production until public location consent UX is ready.
-- Approximate, public-facing coordinates only; never store a residential address.
alter table public.ifund_campaigns
  add column if not exists latitude numeric(8,5),
  add column if not exists longitude numeric(8,5);

alter table public.ifund_campaigns
  add constraint ifund_atlas_latitude_range check (latitude between -90 and 90),
  add constraint ifund_atlas_longitude_range check (longitude between -180 and 180),
  add constraint ifund_atlas_location_pair check ((latitude is null) = (longitude is null));

-- Keep location editing owner-only through existing campaign RLS.
-- Existing client grants are column-restricted; no latitude/longitude write grants
-- are added here until explicit opt-in UI and precision safeguards exist.
-- SELECT of active campaigns is already public, so any coordinates stored here
-- are public. This is why the migration must remain pending.
