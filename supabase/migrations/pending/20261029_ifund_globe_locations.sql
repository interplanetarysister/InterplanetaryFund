-- STAGED ONLY. Add opt-in geolocation for the ORIGINAL 3D public globe.
-- Do not backfill or infer location from legacy owners' addresses, IP, email
-- or private campaign metadata. Obtain verified campaign-owner publication consent.
BEGIN;
ALTER TABLE public.ifund_campaigns
 ADD COLUMN IF NOT EXISTS location text,
 ADD COLUMN IF NOT EXISTS location_lat numeric(9,6),
 ADD COLUMN IF NOT EXISTS location_lng numeric(9,6),
 ADD COLUMN IF NOT EXISTS globe_visible boolean NOT NULL DEFAULT false;
ALTER TABLE public.ifund_campaigns
 ADD CONSTRAINT ifund_campaign_globe_coord_bounds
 CHECK (
  (location_lat IS NULL AND location_lng IS NULL)
  OR (
   location_lat BETWEEN -90 AND 90 AND
   location_lng BETWEEN -180 AND 180
  )
 );
CREATE INDEX ifund_campaign_globe_active
 ON public.ifund_campaigns(created_at DESC)
 WHERE status='active' AND globe_visible=true;
-- Existing public campaign SELECT/RLS intentionally remains unchanged.
-- Only public campaigns already visible to the user can be returned by
-- their current RLS policies. This migration grants no new permissions.
COMMIT;
