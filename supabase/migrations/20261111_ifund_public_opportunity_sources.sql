-- IFund canonical public institutional research-source directory.
-- Only individually reviewed, explicitly tagged external sources are exposed.
-- No private institution applications, volunteer signups or payment data are exposed.
BEGIN;
ALTER TABLE public.ifund_institution ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.ifund_institution TO anon, authenticated;
DROP POLICY IF EXISTS ifund_public_research_sources_read ON public.ifund_institution;
CREATE POLICY ifund_public_research_sources_read ON public.ifund_institution
FOR SELECT TO anon, authenticated
USING (
  source_system = 'ifund_public_research_v1'
  AND verification_status = 'verified'
  AND website LIKE 'https://%'
);
COMMIT;
