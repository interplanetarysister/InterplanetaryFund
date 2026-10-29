-- IFund institutional partner discovery and opportunity reader.
-- DRAFT ONLY: not authorized for production SQL execution or deployment.
-- Original Base44 Institution/InstitutionOpportunity data require independent
-- ownership and publication-consent verification prior to import.
BEGIN;
CREATE TABLE public.ifund_institutions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 160),
 type text NOT NULL DEFAULT 'business' CHECK(type IN
 ('business','nonprofit','foundation','corporate_foundation','school','university',
 'hospital','faith','community_org','government','association','research','ngo','other')),
 mission text, description text, industry text, location text, website text,
 causes_supported text, logo_url text,
 offers_matching_gifts boolean NOT NULL DEFAULT false,
 offers_volunteer_program boolean NOT NULL DEFAULT false,
 offers_grants boolean NOT NULL DEFAULT false,
 verification_status text NOT NULL DEFAULT 'unverified'
   CHECK(verification_status IN('unverified','pending','verified')),
 is_public boolean NOT NULL DEFAULT false,
 public_approved_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT institution_public_approval CHECK (NOT is_public OR public_approved_at IS NOT NULL)
);
CREATE INDEX ifund_institutions_public_idx ON public.ifund_institutions(created_at DESC)
 WHERE is_public = true;
CREATE INDEX ifund_institutions_owner_idx ON public.ifund_institutions(owner_id);
CREATE TABLE public.ifund_institution_opportunities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 institution_id uuid NOT NULL REFERENCES public.ifund_institutions(id) ON DELETE RESTRICT,
 title text NOT NULL CHECK(length(title) BETWEEN 3 AND 180),
 category text NOT NULL DEFAULT 'grant' CHECK(category IN
 ('grant','funding_program','matching_gift','in_kind','professional_services','facility',
  'equipment','volunteers','mentorship','training','research','other')),
 description text, award_amount text, eligibility text, requirements text,
 deadline date, status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
 approved_for_public boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ifund_institution_opportunities_public_idx ON public.ifund_institution_opportunities(institution_id, status);
ALTER TABLE public.ifund_institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ifund_institution_opportunities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ifund_institutions,public.ifund_institution_opportunities FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.ifund_institutions,public.ifund_institution_opportunities TO anon,authenticated;
CREATE POLICY ifund_institutions_reader ON public.ifund_institutions
  FOR SELECT TO anon,authenticated USING (is_public=true AND public_approved_at IS NOT NULL);
CREATE POLICY ifund_opportunities_reader ON public.ifund_institution_opportunities
  FOR SELECT TO anon,authenticated USING (
   approved_for_public=true AND EXISTS(
    SELECT 1 FROM public.ifund_institutions i
    WHERE i.id=institution_id AND i.is_public=true AND i.public_approved_at IS NOT NULL
   )
  );
-- All institution modifications and opportunity applications require an
-- audited independent server handler with member/owner/moderator entitlement.
-- No browser write policies are enabled here. No contact_email exposed.
COMMIT;
