-- Corrective lifecycle provenance migration.
-- Replaces timestamp-based assumptions with explicit trusted provenance.
-- Existing accounts are active only when a verified source-owner mapping is
-- present; future independent signups are marked by the trusted Auth trigger.
BEGIN;

ALTER TABLE public.ifund_profiles
  ADD COLUMN IF NOT EXISTS lifecycle_provenance text;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.ifund_profiles'::regclass
      AND conname='ifund_profiles_lifecycle_provenance_allowed'
  ) THEN
    ALTER TABLE public.ifund_profiles
      ADD CONSTRAINT ifund_profiles_lifecycle_provenance_allowed
      CHECK (
        lifecycle_provenance IS NULL
        OR lifecycle_provenance IN ('verified_source_owner_mapping','supabase_auth_signup')
      );
  END IF;
END
$constraint$;

REVOKE INSERT (lifecycle_provenance),
       UPDATE (lifecycle_provenance)
ON TABLE public.ifund_profiles
FROM PUBLIC, anon, authenticated;
GRANT SELECT (lifecycle_provenance),
      UPDATE (lifecycle_provenance, account_status, account_deletion_pending)
ON TABLE public.ifund_profiles
TO service_role;

-- Only exact, confirmed, active source-owner matches can retain an active
-- legacy identity. The query is data-driven; it does not infer trust from a
-- profile timestamp or a migration filename.
UPDATE public.ifund_profiles AS profile
SET lifecycle_provenance='verified_source_owner_mapping',
    account_status='active',
    account_deletion_pending=false
FROM ifund_transfer.owner_identity_map AS mapping
JOIN ifund_stage."user" AS source_user
  ON source_user.legacy_id=mapping.source_owner_id
JOIN auth.users AS destination_user
  ON destination_user.id=mapping.destination_auth_uid
WHERE profile.id=mapping.destination_auth_uid
  AND mapping.verification_state='verified'
  AND mapping.candidate_match_method='confirmed_exact_email'
  AND mapping.destination_auth_uid IS NOT NULL
  AND lower(mapping.source_email)=lower(destination_user.email)
  AND destination_user.email_confirmed_at IS NOT NULL
  AND source_user.account_status='active'
  AND source_user.account_deletion_pending IS FALSE;

-- Any profile without trusted signup provenance or a currently verified
-- source mapping remains blocked until a new, auditable reconciliation.
UPDATE public.ifund_profiles AS profile
SET lifecycle_provenance=NULL,
    account_status=NULL,
    account_deletion_pending=NULL
WHERE profile.lifecycle_provenance IS DISTINCT FROM 'supabase_auth_signup'
  AND NOT EXISTS (
    SELECT 1
    FROM ifund_transfer.owner_identity_map AS mapping
    JOIN ifund_stage."user" AS source_user
      ON source_user.legacy_id=mapping.source_owner_id
    JOIN auth.users AS destination_user
      ON destination_user.id=mapping.destination_auth_uid
    WHERE mapping.destination_auth_uid=profile.id
      AND mapping.verification_state='verified'
      AND mapping.candidate_match_method='confirmed_exact_email'
      AND lower(mapping.source_email)=lower(destination_user.email)
      AND destination_user.email_confirmed_at IS NOT NULL
      AND source_user.account_status='active'
      AND source_user.account_deletion_pending IS FALSE
  );

CREATE OR REPLACE FUNCTION public.ifund_create_auth_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.ifund_profiles
    (id, display_name, account_status, account_deletion_pending, lifecycle_provenance)
  VALUES
    (
      new.id,
      nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 120), ''),
      'active',
      false,
      'supabase_auth_signup'
    )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.ifund_create_auth_profile()
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ifund_create_auth_profile()
TO supabase_auth_admin;

DO $postflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.ifund_profiles profile
    WHERE profile.account_status='active'
      AND profile.lifecycle_provenance IS NULL
  ) THEN
    RAISE EXCEPTION 'Active profile lacks trusted lifecycle provenance.';
  END IF;
  IF has_column_privilege('anon','public.ifund_profiles','lifecycle_provenance','INSERT')
     OR has_column_privilege('authenticated','public.ifund_profiles','lifecycle_provenance','INSERT')
     OR has_column_privilege('anon','public.ifund_profiles','lifecycle_provenance','UPDATE')
     OR has_column_privilege('authenticated','public.ifund_profiles','lifecycle_provenance','UPDATE') THEN
    RAISE EXCEPTION 'Browser roles can modify lifecycle provenance.';
  END IF;
  IF NOT has_function_privilege('supabase_auth_admin','public.ifund_create_auth_profile()','EXECUTE')
     OR has_function_privilege('anon','public.ifund_create_auth_profile()','EXECUTE')
     OR has_function_privilege('authenticated','public.ifund_create_auth_profile()','EXECUTE') THEN
    RAISE EXCEPTION 'Auth trigger function ACL is not restricted.';
  END IF;
END
$postflight$;

COMMENT ON COLUMN public.ifund_profiles.lifecycle_provenance IS
  'Trusted server-set origin for lifecycle status; NULL means unverified and blocks protected features.';
COMMIT;
