-- Enforce donor-only access to captured gifts and restore correct public campaign visibility.
-- Processor identifiers remain inaccessible to browser roles.
BEGIN;

DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'ifund_donations'
      AND c.relrowsecurity IS TRUE
  ) THEN
    RAISE EXCEPTION 'ifund_donations must have RLS enabled before donor access is granted.';
  END IF;
  IF to_regprocedure('public.ifund_current_account_is_active()') IS NULL THEN
    RAISE EXCEPTION 'The verified account lifecycle predicate is missing.';
  END IF;
END;
$preflight$;

-- Never expose PayPal order/capture identifiers or grant broad table SELECT.
REVOKE SELECT ON TABLE public.ifund_donations FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, donor_id, campaign_id, gift_cents, optional_support_cents,
  currency, status, captured_at
) ON TABLE public.ifund_donations TO authenticated;

DROP POLICY IF EXISTS ifund_donations_donor_captured_select ON public.ifund_donations;
CREATE POLICY ifund_donations_donor_captured_select
ON public.ifund_donations
FOR SELECT TO authenticated
USING (
  donor_id = (SELECT auth.uid())
  AND status = 'captured'
  AND (SELECT public.ifund_current_account_is_active())
);

-- Anonymous visitors see active campaigns only. Signed-in active members can
-- also see their own campaigns and campaigns with their own captured gifts.
DROP POLICY IF EXISTS ifund_campaigns_public_read ON public.ifund_campaigns;
CREATE POLICY ifund_campaigns_public_read
ON public.ifund_campaigns
FOR SELECT TO anon, authenticated
USING (
  (
    (SELECT auth.uid()) IS NULL
    AND status = 'active'
  )
  OR
  (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT public.ifund_current_account_is_active())
    AND (
      status = 'active'
      OR owner_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.ifund_donations AS d
        WHERE d.campaign_id = ifund_campaigns.id
          AND d.donor_id = (SELECT auth.uid())
          AND d.status = 'captured'
      )
    )
  )
);

COMMIT;
