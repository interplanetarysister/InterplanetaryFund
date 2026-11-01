-- Applied migration 20261030152355_ifund_legal_acceptances_owner_scoped.
-- Reconstructed from the live schema, constraints, grants, and RLS policies on 2026-10-30.
BEGIN;
CREATE TABLE IF NOT EXISTS public.ifund_legal_acceptances (
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version text NOT NULL,
  explicit_consent boolean NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  acceptance_method text NOT NULL DEFAULT 'explicit_checkbox_and_button',
  terms_path text NOT NULL DEFAULT '/terms',
  privacy_path text NOT NULL DEFAULT '/privacy',
  CONSTRAINT ifund_legal_acceptances_pkey PRIMARY KEY (owner_id, terms_version),
  CONSTRAINT ifund_legal_acceptances_terms_version_check CHECK (terms_version = '2026-10-13-v3'),
  CONSTRAINT ifund_legal_acceptances_explicit_consent_check CHECK (explicit_consent = true),
  CONSTRAINT ifund_legal_acceptance_method_check CHECK (acceptance_method = 'explicit_checkbox_and_button'),
  CONSTRAINT ifund_legal_acceptance_terms_path_check CHECK (terms_path = '/terms'),
  CONSTRAINT ifund_legal_acceptance_privacy_path_check CHECK (privacy_path = '/privacy')
);
ALTER TABLE public.ifund_legal_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ifund_legal_acceptances FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ifund_legal_acceptances TO authenticated;
GRANT INSERT (owner_id, terms_version, explicit_consent, acceptance_method, terms_path, privacy_path)
  ON TABLE public.ifund_legal_acceptances TO authenticated;
GRANT ALL ON TABLE public.ifund_legal_acceptances TO service_role;
DROP POLICY IF EXISTS ifund_legal_acceptance_owner_select ON public.ifund_legal_acceptances;
CREATE POLICY ifund_legal_acceptance_owner_select ON public.ifund_legal_acceptances
  FOR SELECT TO authenticated USING (owner_id=(select auth.uid()));
DROP POLICY IF EXISTS ifund_legal_acceptance_owner_insert ON public.ifund_legal_acceptances;
CREATE POLICY ifund_legal_acceptance_owner_insert ON public.ifund_legal_acceptances
  FOR INSERT TO authenticated WITH CHECK (owner_id=(select auth.uid()) AND explicit_consent=true);
COMMENT ON TABLE public.ifund_legal_acceptances IS 'Immutable owner-scoped record of explicit acceptance of the current Terms and Privacy Policy.';
COMMIT;
