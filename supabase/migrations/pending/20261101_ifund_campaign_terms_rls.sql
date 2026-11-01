-- REVIEW ONLY / UNAPPLIED. Do not run against canonical production without
-- owner authorization, independent RLS review, and rollback-only two-user tests.
-- Prevent direct PostgREST campaign writes from bypassing the UI/Worker Terms gate.
-- Current Terms: apps/web/src/lib/legalPolicy.js, worker/legalConsent.js.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.ifund_campaigns') IS NULL
     OR to_regclass('public.ifund_legal_acceptances') IS NULL
     OR to_regprocedure('public.ifund_current_account_is_active()') IS NULL THEN
    RAISE EXCEPTION 'Required campaign, legal acceptance, or lifecycle contract missing.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='ifund_campaigns' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Campaign RLS must be enabled before policy replacement.';
  END IF;
END;
$preflight$;

-- Replacing existing permissive policies is required: an additional permissive
-- policy would be OR-ed with the old owner-only policy and would not close
-- the direct-PostgREST bypass. No service_role grant or money write is added.
DROP POLICY IF EXISTS ifund_campaigns_insert ON public.ifund_campaigns;
CREATE POLICY ifund_campaigns_insert ON public.ifund_campaigns
FOR INSERT TO authenticated
WITH CHECK (
  owner_id = (SELECT auth.uid())
  AND (SELECT public.ifund_current_account_is_active())
  AND EXISTS (
    SELECT 1 FROM public.ifund_legal_acceptances a
    WHERE a.owner_id = (SELECT auth.uid())
      AND a.terms_version = '2026-10-13-v3'
      AND a.explicit_consent IS TRUE
      AND a.accepted_at IS NOT NULL
  )
);

DROP POLICY IF EXISTS ifund_campaigns_update ON public.ifund_campaigns;
CREATE POLICY ifund_campaigns_update ON public.ifund_campaigns
FOR UPDATE TO authenticated
USING (
  owner_id = (SELECT auth.uid())
  AND (SELECT public.ifund_current_account_is_active())
  AND EXISTS (
    SELECT 1 FROM public.ifund_legal_acceptances a
    WHERE a.owner_id = (SELECT auth.uid())
      AND a.terms_version = '2026-10-13-v3'
      AND a.explicit_consent IS TRUE
      AND a.accepted_at IS NOT NULL
  )
)
WITH CHECK (
  owner_id = (SELECT auth.uid())
  AND (SELECT public.ifund_current_account_is_active())
  AND EXISTS (
    SELECT 1 FROM public.ifund_legal_acceptances a
    WHERE a.owner_id = (SELECT auth.uid())
      AND a.terms_version = '2026-10-13-v3'
      AND a.explicit_consent IS TRUE
      AND a.accepted_at IS NOT NULL
  )
);

DROP POLICY IF EXISTS ifund_campaigns_delete ON public.ifund_campaigns;
CREATE POLICY ifund_campaigns_delete ON public.ifund_campaigns
FOR DELETE TO authenticated
USING (
  owner_id = (SELECT auth.uid())
  AND status = 'draft'
  AND (SELECT public.ifund_current_account_is_active())
  AND EXISTS (
    SELECT 1 FROM public.ifund_legal_acceptances a
    WHERE a.owner_id = (SELECT auth.uid())
      AND a.terms_version = '2026-10-13-v3'
      AND a.explicit_consent IS TRUE
      AND a.accepted_at IS NOT NULL
  )
);

COMMIT;
