-- Split anonymous and authenticated campaign reads so anon does not need
-- any privilege on the private donations table used by the donor-history join.
BEGIN;

DROP POLICY IF EXISTS ifund_campaigns_public_read ON public.ifund_campaigns;

CREATE POLICY ifund_campaigns_anon_read
ON public.ifund_campaigns
FOR SELECT TO anon
USING (status = 'active');

CREATE POLICY ifund_campaigns_authenticated_read
ON public.ifund_campaigns
FOR SELECT TO authenticated
USING (
  (SELECT public.ifund_current_account_is_active())
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
);

COMMIT;
