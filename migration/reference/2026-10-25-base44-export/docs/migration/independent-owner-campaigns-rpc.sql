-- SOURCE-ONLY STAGING. DO NOT APPLY UNTIL destination identities are independently verified.
-- This creates a narrowly scoped owner-only read RPC; it does not grant table
-- or schema access to anon/authenticated, and it never returns donation totals,
-- payment references, owner email, private AI profiles, or financial ledgers.
-- Requires ifund_migration.campaign_shadow and owner_identity_map to exist.
-- Must be reviewed and deployed as a separate reversible migration.
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
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.destination_auth_uid, c.source_id, c.title, c.summary, c.story,
         c.status, c.category, c.goal_amount, c.cover_image_url, c.end_date,
         c.location, c.source_updated_at
  FROM ifund_migration.campaign_shadow AS c
  JOIN ifund_migration.owner_identity_map AS m
    ON m.source_owner_id = c.source_owner_id
  WHERE auth.uid() IS NOT NULL
    AND m.destination_auth_uid = auth.uid()
    AND m.verification_state = 'verified'
  ORDER BY c.source_id
  LIMIT 50
$$;

REVOKE ALL ON FUNCTION public.ifund_migration_my_campaigns() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ifund_migration_my_campaigns() TO authenticated;
COMMIT;

-- Rollback, only if this migration has actually been applied:
-- DROP FUNCTION IF EXISTS public.ifund_migration_my_campaigns();
