-- SOURCE-STAGED ONLY. Do NOT apply during the full-site release hold.
-- The SQL function authorizes an already-confirmed member, holds one row-level
-- quota per UTC day, and caps all image attempts at 50 per day and 3 per owner.
-- Even if inference fails, the attempt consumes quota to resist abuse.
-- These are attempt limits, not guarantees about other Workers AI consumption.
-- IMPORTANT: keep the accepted terms version in sync with apps/web/src/lib/legalPolicy.js.

CREATE TABLE IF NOT EXISTS ifund_ops.ai_image_daily (
  quota_date date NOT NULL,
  owner_id uuid NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  PRIMARY KEY (quota_date, owner_id)
);

ALTER TABLE ifund_ops.ai_image_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE ifund_ops.ai_image_daily FROM PUBLIC, anon, authenticated;
-- No browser-facing SELECT/INSERT/UPDATE/DELETE grants or policies.

CREATE OR REPLACE FUNCTION public.ifund_ai_image_consume_free_quota()
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $quota$
DECLARE
  v_owner uuid := auth.uid();
  v_date date := (now() AT TIME ZONE 'UTC')::date;
  v_total integer;
  v_attempts integer;
BEGIN
  IF v_owner IS NULL OR
     NOT EXISTS (
       SELECT 1 FROM auth.users AS u
       JOIN public.ifund_profiles AS profile ON profile.id = u.id
       WHERE u.id = v_owner
         AND u.email_confirmed_at IS NOT NULL
         AND COALESCE(u.is_anonymous, TRUE) = FALSE
         AND u.deleted_at IS NULL
         AND profile.account_status = 'active'
         AND COALESCE(profile.account_deletion_pending, TRUE) = FALSE
     ) OR
     NOT EXISTS (
       SELECT 1 FROM public.ifund_legal_acceptances AS accepted
       WHERE accepted.owner_id = v_owner
         AND accepted.terms_version = '2026-11-10-v4'
         AND accepted.explicit_consent IS TRUE
     )
  THEN
    RAISE EXCEPTION 'Verified member agreement and active account required'
      USING ERRCODE = '42501';
  END IF;

  -- A transaction-scoped global lock makes the 50-attempt daily ceiling
  -- atomic across concurrent Worker invocations and different member IDs.
  PERFORM pg_catalog.pg_advisory_xact_lock(20261113, 50);
  -- Quota rows are temporary safeguards, not permanent usage profiles.
  -- Keep at most the last seven UTC days of owner identifiers.
  DELETE FROM ifund_ops.ai_image_daily AS expired
  WHERE expired.quota_date < v_date - 7;
  SELECT COALESCE(sum(q.attempts), 0)::integer INTO v_total
  FROM ifund_ops.ai_image_daily AS q
  WHERE q.quota_date = v_date;
  IF v_total >= 50 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO ifund_ops.ai_image_daily AS q (quota_date, owner_id, attempts)
  VALUES (v_date, v_owner, 1)
  ON CONFLICT (quota_date, owner_id)
  DO UPDATE SET attempts = q.attempts + 1
  WHERE q.attempts < 3
  RETURNING attempts INTO v_attempts;

  RETURN COALESCE(v_attempts BETWEEN 1 AND 3, FALSE);
END;
$quota$;

REVOKE ALL ON FUNCTION public.ifund_ai_image_consume_free_quota()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ifund_ai_image_consume_free_quota()
  TO authenticated;
COMMENT ON FUNCTION public.ifund_ai_image_consume_free_quota() IS
'Confirmed, non-anonymous active IFund member with explicit legal agreement; 3 image attempts/account/day and 50 global/day, UTC. Usage charged before inference.';
