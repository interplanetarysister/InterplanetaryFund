
DO $$
DECLARE
  eligible_rows integer;
  updated_rows integer;
BEGIN
  SELECT count(*)
    INTO eligible_rows
  FROM ifund_transfer.owner_identity_map AS m
  JOIN ifund_stage."user" AS source_user
    ON source_user.legacy_id = m.source_owner_id
  JOIN auth.users AS destination_user
    ON destination_user.id = m.destination_auth_uid
  JOIN public.ifund_profiles AS profile
    ON profile.id = m.destination_auth_uid
  WHERE m.verification_state = 'verified'
    AND m.candidate_match_method = 'confirmed_exact_email'
    AND m.destination_auth_uid IS NOT NULL
    AND lower(m.source_email) = lower(destination_user.email)
    AND destination_user.email_confirmed_at IS NOT NULL
    AND source_user.account_status = 'active'
    AND source_user.account_deletion_pending IS FALSE
    AND profile.account_status IS NULL
    AND profile.account_deletion_pending IS NULL;

  IF eligible_rows <> 3 THEN
    RAISE EXCEPTION 'Expected exactly 3 verified, confirmed, active source-owner mappings with pending target lifecycle; found %', eligible_rows;
  END IF;

  UPDATE public.ifund_profiles AS profile
  SET account_status = 'active',
      account_deletion_pending = FALSE
  FROM ifund_transfer.owner_identity_map AS m
  JOIN ifund_stage."user" AS source_user
    ON source_user.legacy_id = m.source_owner_id
  JOIN auth.users AS destination_user
    ON destination_user.id = m.destination_auth_uid
  WHERE m.verification_state = 'verified'
    AND m.candidate_match_method = 'confirmed_exact_email'
    AND m.destination_auth_uid IS NOT NULL
    AND lower(m.source_email) = lower(destination_user.email)
    AND destination_user.email_confirmed_at IS NOT NULL
    AND source_user.account_status = 'active'
    AND source_user.account_deletion_pending IS FALSE
    AND profile.id = m.destination_auth_uid
    AND profile.account_status IS NULL
    AND profile.account_deletion_pending IS NULL;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  IF updated_rows <> eligible_rows THEN
    RAISE EXCEPTION 'Lifecycle reconciliation updated % rows; expected %', updated_rows, eligible_rows;
  END IF;
END
$$;

GRANT INSERT (owner_id, terms_version, explicit_consent)
ON TABLE public.ifund_legal_acceptances
TO authenticated;
