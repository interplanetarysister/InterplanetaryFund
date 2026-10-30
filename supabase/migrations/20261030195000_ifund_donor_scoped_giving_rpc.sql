-- Donor-scoped giving history without a server-wide service-role credential.
-- The function returns only captured donations belonging to the caller's active account.
BEGIN;

CREATE OR REPLACE FUNCTION public.ifund_get_my_giving_history()
RETURNS TABLE (
  id uuid,
  donor_id uuid,
  campaign_id uuid,
  campaign_title text,
  gift_cents bigint,
  optional_support_cents bigint,
  currency text,
  status text,
  captured_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT
    d.id,
    d.donor_id,
    d.campaign_id,
    c.title,
    d.gift_cents,
    d.optional_support_cents,
    d.currency,
    d.status,
    d.captured_at
  FROM public.ifund_donations AS d
  JOIN public.ifund_campaigns AS c ON c.id = d.campaign_id
  JOIN public.ifund_profiles AS p ON p.id = auth.uid()
  WHERE d.donor_id = auth.uid()
    AND d.status = 'captured'
    AND d.currency = 'USD'
    AND p.account_status = 'active'
    AND p.account_deletion_pending IS FALSE
  ORDER BY d.captured_at DESC
  LIMIT 1001;
$function$;

REVOKE ALL ON FUNCTION public.ifund_get_my_giving_history()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ifund_get_my_giving_history()
TO authenticated;

COMMENT ON FUNCTION public.ifund_get_my_giving_history() IS
  'Returns at most 1001 captured USD donations and campaign titles for auth.uid() only, and only while that account has an explicitly active lifecycle state. Does not expose processor identifiers or permit writes.';

COMMIT;
