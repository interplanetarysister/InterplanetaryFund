BEGIN;

CREATE OR REPLACE FUNCTION public.ifund_migration_my_campaigns()
RETURNS TABLE (
  owner_auth_uid uuid,
  source_id text,
  title text,
  summary text,
  story text,
  status text,
  category text,
  goal_amount numeric,
  cover_image_url text,
  end_date date,
  location text,
  source_updated_at text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    c.owner_auth_uid,
    c.legacy_id,
    c.title,
    c.summary,
    c.story,
    c.status,
    c.category,
    c.goal_amount,
    c.cover_image_url,
    CASE
      WHEN c.end_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       AND pg_catalog.pg_input_is_valid(c.end_date, 'date')
      THEN c.end_date::date
      ELSE NULL
    END,
    c.location,
    cs.source_payload->>'source_updated_at'
  FROM ifund_stage.campaign AS c
  JOIN ifund_transfer.campaign_snapshots AS cs
    ON cs.source_id = c.legacy_id
  JOIN ifund_transfer.owner_identity_map AS m
    ON m.source_owner_id = cs.source_payload->>'source_owner_id'
  WHERE auth.uid() IS NOT NULL
    AND public.ifund_current_account_is_active() IS TRUE
    AND c.owner_auth_uid = auth.uid()
    AND m.destination_auth_uid = auth.uid()
    AND m.verification_state = 'verified'
    AND cs.financial_authoritative IS FALSE
  ORDER BY c.legacy_id
  LIMIT 50;
$function$;

REVOKE ALL ON FUNCTION public.ifund_migration_my_campaigns()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ifund_migration_my_campaigns()
  TO authenticated, service_role;

COMMENT ON FUNCTION public.ifund_migration_my_campaigns() IS
  'Owner-only read of non-financial staged campaign metadata. Requires a verified source-to-destination owner mapping and an active, non-deletion-pending canonical profile. Date text is validated before casting.';

COMMIT;