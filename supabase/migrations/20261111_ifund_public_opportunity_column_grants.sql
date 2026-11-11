-- Public opportunity directory data minimization.
-- The table can contain private institution administrative data; anon access is
-- limited to the explicit fields consumed by the verified public RLS-filtered API.
BEGIN;
REVOKE SELECT ON public.ifund_institution FROM anon, authenticated;
GRANT SELECT (id,name,type,industry,mission,description,location,website,
 causes_supported,offers_grants,offers_volunteer_program,verification_status,source_system)
ON public.ifund_institution TO anon, authenticated;
COMMIT;
