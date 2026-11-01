BEGIN;
ALTER TABLE public.ifund_legal_acceptances
  ADD COLUMN acceptance_method text NOT NULL DEFAULT 'explicit_checkbox_and_button',
  ADD COLUMN terms_path text NOT NULL DEFAULT '/terms',
  ADD COLUMN privacy_path text NOT NULL DEFAULT '/privacy';

ALTER TABLE public.ifund_legal_acceptances
  ADD CONSTRAINT ifund_legal_acceptance_method_check
    CHECK (acceptance_method = 'explicit_checkbox_and_button'),
  ADD CONSTRAINT ifund_legal_acceptance_terms_path_check
    CHECK (terms_path = '/terms'),
  ADD CONSTRAINT ifund_legal_acceptance_privacy_path_check
    CHECK (privacy_path = '/privacy');

GRANT INSERT (acceptance_method, terms_path, privacy_path)
  ON TABLE public.ifund_legal_acceptances TO authenticated;

COMMENT ON COLUMN public.ifund_legal_acceptances.acceptance_method IS
  'Fixed audit value proving acceptance used an explicit checkbox and button.';
COMMENT ON COLUMN public.ifund_legal_acceptances.terms_path IS
  'Exact Terms document route presented at acceptance.';
COMMENT ON COLUMN public.ifund_legal_acceptances.privacy_path IS
  'Exact Privacy document route presented at acceptance.';
COMMIT;