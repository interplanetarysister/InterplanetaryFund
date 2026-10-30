-- Owner-scoped My Giving read path.
-- This migration is staged only. Do not apply until the missing applied
-- migration history and source Donation snapshots/identity mappings are reconciled.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('ifund_finance.donation') IS NULL
     OR to_regclass('ifund_stage."user"') IS NULL
     OR to_regclass('ifund_transfer.source_snapshots') IS NULL
     OR to_regclass('public.ifund_donations') IS NULL
     OR to_regclass('public.ifund_campaigns') IS NULL THEN
    RAISE EXCEPTION 'Giving source, identity, or operational ledger tables are missing.';
  END IF;

  IF to_regprocedure('public.ifund_current_account_is_active()') IS NULL THEN
    RAISE EXCEPTION 'The verified account lifecycle predicate is missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'ifund_finance' AND c.relname = 'donation'
      AND c.relrowsecurity IS TRUE
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'ifund_stage' AND c.relname = 'user'
      AND c.relrowsecurity IS TRUE
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'ifund_transfer' AND c.relname = 'source_snapshots'
      AND c.relrowsecurity IS TRUE
  ) THEN
    RAISE EXCEPTION 'Private giving source and identity tables must retain RLS.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'ifund_donations'
      AND c.relrowsecurity IS TRUE
  ) THEN
    RAISE EXCEPTION 'The operational donation ledger must retain RLS.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ifund_donations'
      AND policyname = 'ifund_donations_donor_captured_select' AND cmd = 'SELECT'
      AND roles @> ARRAY['authenticated']::name[]
      AND qual ILIKE '%auth.uid%' AND qual ILIKE '%captured%'
      AND qual ILIKE '%ifund_current_account_is_active%'
  ) THEN
    RAISE EXCEPTION 'The operational donation ledger must retain its donor-only captured-gift policy.';
  END IF;

  IF has_column_privilege('anon', 'public.ifund_donations', 'paypal_order_id', 'SELECT')
     OR has_column_privilege('authenticated', 'public.ifund_donations', 'paypal_order_id', 'SELECT')
     OR has_column_privilege('anon', 'public.ifund_donations', 'paypal_capture_id', 'SELECT')
     OR has_column_privilege('authenticated', 'public.ifund_donations', 'paypal_capture_id', 'SELECT') THEN
    RAISE EXCEPTION 'Processor order and capture identifiers must remain inaccessible to browser roles.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'ifund_finance' AND tablename = 'donation'
      AND policyname = 'deny_clients_donation' AND cmd = 'ALL'
      AND roles @> ARRAY['anon', 'authenticated']::name[]
      AND qual = 'false' AND with_check = 'false'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'ifund_stage' AND tablename = 'user'
      AND policyname = 'deny_clients_user' AND cmd = 'ALL'
      AND roles @> ARRAY['anon', 'authenticated']::name[]
      AND qual = 'false' AND with_check = 'false'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'ifund_transfer' AND tablename = 'source_snapshots'
      AND policyname = 'deny_clients_source_snapshots' AND cmd = 'ALL'
      AND roles @> ARRAY['anon', 'authenticated']::name[]
      AND qual = 'false' AND with_check = 'false'
  ) THEN
    RAISE EXCEPTION 'Private giving source, identity, and provenance policies must deny browser roles.';
  END IF;

  IF EXISTS (
    SELECT required.column_name
    FROM unnest(ARRAY[
      'id', 'legacy_id', 'owner_auth_uid', 'campaign_id', 'campaign_title',
      'amount', 'platform_contribution', 'processing_fee', 'donor_name',
      'is_recurring', 'recurring_status', 'donor_user_id',
      'canonical_operation_id', 'stripe_session_id', 'payment_method',
      'payment_verified', 'provider_transaction_id', 'migration_recorded_at'
    ]::text[]) AS required(column_name)
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'ifund_finance' AND c.table_name = 'donation'
        AND c.column_name = required.column_name
    )
  ) THEN
    RAISE EXCEPTION 'The private Donation mirror does not match the expected source contract.';
  END IF;

  IF EXISTS (
    SELECT required.column_name
    FROM unnest(ARRAY[
      'id', 'donor_id', 'campaign_id', 'gift_cents', 'optional_support_cents',
      'currency', 'status', 'captured_at', 'paypal_order_id', 'paypal_capture_id'
    ]::text[]) AS required(column_name)
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'ifund_donations'
        AND c.column_name = required.column_name
    )
  ) OR EXISTS (
    SELECT required.column_name
    FROM unnest(ARRAY['id', 'title']::text[]) AS required(column_name)
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'ifund_campaigns'
        AND c.column_name = required.column_name
    )
  ) THEN
    RAISE EXCEPTION 'The operational donation or campaign read contract is incomplete.';
  END IF;

  IF EXISTS (
    SELECT required.column_name
    FROM unnest(ARRAY['legacy_id', 'owner_auth_uid']::text[]) AS required(column_name)
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'ifund_stage' AND c.table_name = 'user'
        AND c.column_name = required.column_name
    )
  ) THEN
    RAISE EXCEPTION 'The staged User identity map is incomplete.';
  END IF;

  IF EXISTS (
    SELECT required.column_name
    FROM unnest(ARRAY['entity_type', 'source_id', 'source_payload', 'source_verified', 'imported_at']::text[]) AS required(column_name)
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'ifund_transfer' AND c.table_name = 'source_snapshots'
        AND c.column_name = required.column_name
    )
  ) THEN
    RAISE EXCEPTION 'The source provenance snapshot schema is incomplete.';
  END IF;
END;
$preflight$;

CREATE INDEX IF NOT EXISTS ifund_finance_donation_owner_verified_recent
ON ifund_finance.donation (owner_auth_uid, migration_recorded_at DESC)
WHERE payment_verified IS TRUE;

CREATE INDEX IF NOT EXISTS ifund_transfer_verified_donation_snapshot_lookup
ON ifund_transfer.source_snapshots (entity_type, source_id, imported_at DESC)
WHERE source_verified IS TRUE;

CREATE INDEX IF NOT EXISTS ifund_donations_donor_captured_recent
ON public.ifund_donations (donor_id, captured_at DESC)
WHERE status = 'captured';

CREATE OR REPLACE FUNCTION public.ifund_my_giving()
RETURNS TABLE (
  id text,
  campaign_id text,
  campaign_title text,
  amount numeric,
  platform_support_amount numeric,
  processing_fee numeric,
  total_charged numeric,
  donor_name text,
  is_recurring boolean,
  recurring_status text,
  payment_method text,
  created_date timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required.';
  END IF;

  IF NOT public.ifund_current_account_is_active() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Account is not active.';
  END IF;

  RETURN QUERY
  WITH legacy AS (
    SELECT
      'legacy:' || COALESCE(d.legacy_id, d.id::text) AS id,
      d.campaign_id,
      COALESCE(NULLIF(pg_catalog.btrim(snapshot.source_payload ->> 'campaign_title'), ''), NULLIF(pg_catalog.btrim(d.campaign_title), ''), 'Campaign') AS campaign_title,
      GREATEST(0, pg_catalog.round(COALESCE(d.amount, 0) - COALESCE(d.platform_contribution, 0), 2)) AS amount,
      pg_catalog.round(COALESCE(d.platform_contribution, 0), 2) AS platform_support_amount,
      pg_catalog.round(COALESCE(d.processing_fee, 0), 2) AS processing_fee,
      pg_catalog.round(COALESCE(d.amount, 0) + COALESCE(d.processing_fee, 0), 2) AS total_charged,
      COALESCE(NULLIF(pg_catalog.btrim(snapshot.source_payload ->> 'donor_name'), ''), NULLIF(pg_catalog.btrim(d.donor_name), ''), 'Anonymous') AS donor_name,
      COALESCE((snapshot.source_payload ->> 'is_recurring')::boolean, false) AS is_recurring,
      COALESCE(
        NULLIF(d.recurring_status, ''),
        CASE WHEN COALESCE((snapshot.source_payload ->> 'is_recurring')::boolean, false) THEN 'active' ELSE NULL END
      ) AS recurring_status,
      CASE
        WHEN COALESCE(snapshot.source_payload ->> 'payment_method', d.payment_method, 'paypal') IN ('paypal', 'googlepay', 'applepay', 'cashapp', 'stripe', 'stripe_crypto', 'other')
          THEN COALESCE(snapshot.source_payload ->> 'payment_method', d.payment_method, 'paypal')
        ELSE 'other'
      END AS payment_method,
      CASE
        WHEN pg_catalog.pg_input_is_valid(snapshot.source_payload ->> 'created_date', 'timestamp with time zone')
          THEN (snapshot.source_payload ->> 'created_date')::timestamptz
        ELSE NULL
      END AS created_date,
      d.provider_transaction_id,
      d.canonical_operation_id,
      d.stripe_session_id
    FROM ifund_finance.donation AS d
    JOIN ifund_stage."user" AS source_user
      ON source_user.legacy_id = d.donor_user_id
     AND source_user.owner_auth_uid = caller_id
    JOIN LATERAL (
      SELECT s.source_payload
      FROM ifund_transfer.source_snapshots AS s
      WHERE s.entity_type = 'Donation'
        AND s.source_id = d.legacy_id
        AND s.source_verified IS TRUE
        AND s.source_payload ->> 'donor_user_id' = d.donor_user_id
        AND s.source_payload ->> 'campaign_id' = d.campaign_id
        AND s.source_payload ->> 'payment_verified' = 'true'
        AND pg_catalog.pg_input_is_valid(s.source_payload ->> 'amount', 'numeric')
        AND (s.source_payload ->> 'amount')::numeric = d.amount
        AND (
          CASE
            WHEN pg_catalog.pg_input_is_valid(s.source_payload ->> 'platform_contribution', 'numeric')
              THEN (s.source_payload ->> 'platform_contribution')::numeric
            ELSE 0
          END
        ) = COALESCE(d.platform_contribution, 0)
        AND (
          CASE
            WHEN pg_catalog.pg_input_is_valid(s.source_payload ->> 'processing_fee', 'numeric')
              THEN (s.source_payload ->> 'processing_fee')::numeric
            ELSE 0
          END
        ) = COALESCE(d.processing_fee, 0)
        AND COALESCE(s.source_payload ->> 'payment_method', 'paypal') = COALESCE(d.payment_method, 'paypal')
        AND COALESCE(s.source_payload ->> 'is_recurring', 'false') = COALESCE(d.is_recurring::text, 'false')
        AND COALESCE(s.source_payload ->> 'recurring_status', '') = COALESCE(d.recurring_status, '')
        AND COALESCE(NULLIF(pg_catalog.btrim(s.source_payload ->> 'donor_name'), ''), 'Anonymous') = COALESCE(NULLIF(pg_catalog.btrim(d.donor_name), ''), 'Anonymous')
        AND COALESCE(NULLIF(pg_catalog.btrim(s.source_payload ->> 'campaign_title'), ''), 'Campaign') = COALESCE(NULLIF(pg_catalog.btrim(d.campaign_title), ''), 'Campaign')
      ORDER BY s.imported_at DESC
      LIMIT 1
    ) AS snapshot ON true
    WHERE d.owner_auth_uid = caller_id
      AND d.donor_user_id IS NOT NULL
      AND d.payment_verified IS TRUE
  ),
  paypal AS (
    SELECT
      'paypal:' || p.id::text AS id,
      p.campaign_id::text AS campaign_id,
      COALESCE(NULLIF(pg_catalog.btrim(c.title), ''), 'Campaign') AS campaign_title,
      p.gift_cents::numeric / 100 AS amount,
      p.optional_support_cents::numeric / 100 AS platform_support_amount,
      NULL::numeric AS processing_fee,
      NULL::numeric AS total_charged,
      'Anonymous'::text AS donor_name,
      false AS is_recurring,
      NULL::text AS recurring_status,
      'paypal'::text AS payment_method,
      p.captured_at AS created_date,
      p.paypal_capture_id,
      p.paypal_order_id
    FROM public.ifund_donations AS p
    LEFT JOIN public.ifund_campaigns AS c ON c.id = p.campaign_id
    WHERE p.donor_id = caller_id
      AND p.status = 'captured'
      AND p.currency = 'USD'
      AND p.captured_at IS NOT NULL
  ),
  combined AS (
    SELECT
      l.id, l.campaign_id, l.campaign_title, l.amount, l.platform_support_amount,
      l.processing_fee, l.total_charged, l.donor_name, l.is_recurring,
      l.recurring_status, l.payment_method, l.created_date
    FROM legacy AS l

    UNION ALL

    SELECT
      p.id, p.campaign_id, p.campaign_title, p.amount, p.platform_support_amount,
      p.processing_fee, p.total_charged, p.donor_name, p.is_recurring,
      p.recurring_status, p.payment_method, p.created_date
    FROM paypal AS p
    WHERE NOT EXISTS (
      SELECT 1
      FROM legacy AS l
      WHERE (p.paypal_capture_id IS NOT NULL AND p.paypal_capture_id IN (
               l.provider_transaction_id, l.canonical_operation_id, l.stripe_session_id
             ))
         OR (p.paypal_order_id IS NOT NULL AND p.paypal_order_id IN (
               l.provider_transaction_id, l.canonical_operation_id, l.stripe_session_id
             ))
    )
  )
  SELECT
    combined.id, combined.campaign_id, combined.campaign_title, combined.amount,
    combined.platform_support_amount, combined.processing_fee, combined.total_charged,
    combined.donor_name, combined.is_recurring, combined.recurring_status,
    combined.payment_method, combined.created_date
  FROM combined
  ORDER BY combined.created_date DESC NULLS LAST, combined.id DESC
  LIMIT 1001;
END;
$function$;

REVOKE ALL ON FUNCTION public.ifund_my_giving()
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ifund_my_giving() TO authenticated;

COMMENT ON FUNCTION public.ifund_my_giving() IS
  'Returns only source-verified legacy gifts mapped to the current Auth user and captured operational PayPal gifts for auth.uid(); never returns processor references or another donor''s data.';

COMMIT;
