-- PENDING / INACTIVE Phase 3 identity claim schema.
-- NO SQL is authorized to execute on any Supabase project without owner review.
-- Independent owner claim; does NOT alter legacy ifund_migration.owner_identity_map or
-- ifund_migration_owner_commit / ifund_migration_owner_lookup RPCs.
CREATE SCHEMA IF NOT EXISTS ifund_identity;
REVOKE ALL ON SCHEMA ifund_identity FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA ifund_identity TO service_role;

CREATE TABLE IF NOT EXISTS ifund_identity.owner_matches (
  source_user_id text PRIMARY KEY,
  source_email text NOT NULL,
  normalized_source_email text GENERATED ALWAYS AS (lower(btrim(source_email))) STORED,
  status text NOT NULL DEFAULT 'awaiting_destination_login'
    CHECK (status IN ('awaiting_destination_login','linked','blocked')),
  linked_auth_uid uuid UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ifund_owner_link_consistent CHECK
    ((status = 'linked' AND linked_auth_uid IS NOT NULL) OR
     (status <> 'linked' AND linked_auth_uid IS NULL))
);
CREATE INDEX IF NOT EXISTS ifund_identity_source_email_idx
ON ifund_identity.owner_matches(normalized_source_email);

CREATE TABLE IF NOT EXISTS ifund_identity.link_challenges (
  challenge_hash text PRIMARY KEY CHECK (challenge_hash ~ '^[a-f0-9]{64}$'),
  source_user_id text NOT NULL REFERENCES ifund_identity.owner_matches(source_user_id) ON DELETE RESTRICT,
  destination_auth_uid uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  proof_kind text NOT NULL CHECK (proof_kind IN ('verified_provider_email','legacy_email_otp')),
  code_to_legacy_email_verified_at timestamptz,
  explicit_user_consent_at timestamptz,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CONSTRAINT ifund_challenge_otp_proof CHECK (
    proof_kind <> 'legacy_email_otp' OR
    code_to_legacy_email_verified_at IS NULL OR
    code_to_legacy_email_verified_at <= now()
  )
);
-- NOTE: do not store raw OTPs, bearer tokens, provider secrets, or user-entered IDs.
CREATE INDEX IF NOT EXISTS ifund_identity_open_challenge_idx
ON ifund_identity.link_challenges(destination_auth_uid, expires_at)
WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS ifund_identity.link_consent_audit (
  challenge_hash text PRIMARY KEY REFERENCES ifund_identity.link_challenges(challenge_hash) ON DELETE RESTRICT,
  source_user_id text NOT NULL REFERENCES ifund_identity.owner_matches(source_user_id) ON DELETE RESTRICT,
  destination_auth_uid uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  proof_kind text NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ifund_identity.owner_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE ifund_identity.link_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE ifund_identity.link_consent_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA ifund_identity FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA ifund_identity TO service_role;

-- Consume explicit consent challenge and link verified identity in ONE transaction.
-- The trusted server must authenticate a fresh Supabase JWT and derive
-- p_authenticated_uid server-side. The client must NOT submit IDs or source email.
CREATE OR REPLACE FUNCTION ifund_identity.claim_verified_owner(
  p_challenge_hash text,
  p_authenticated_uid uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $claim$
DECLARE
  v_candidate ifund_identity.link_challenges%ROWTYPE;
  v_email text;
  v_matches integer;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     OR p_challenge_hash !~ '^[a-f0-9]{64}$' OR p_authenticated_uid IS NULL
  THEN RETURN false; END IF;

  SELECT * INTO v_candidate FROM ifund_identity.link_challenges
  WHERE challenge_hash = p_challenge_hash
    AND destination_auth_uid = p_authenticated_uid
    AND consumed_at IS NULL
    AND expires_at > now()
    AND explicit_user_consent_at IS NOT NULL
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT lower(btrim(u.email)) INTO v_email
  FROM auth.users u
  WHERE u.id = p_authenticated_uid
    AND u.email_confirmed_at IS NOT NULL;
  IF NOT FOUND THEN RETURN false; END IF;

  -- No linking based on name, client-supplied source ID, JWT user_metadata,
  -- or an unconfirmed / non-unique provider email.
  IF v_candidate.proof_kind = 'verified_provider_email' THEN
    SELECT count(*) INTO v_matches
    FROM ifund_identity.owner_matches m
    WHERE m.normalized_source_email = v_email
      AND m.status = 'awaiting_destination_login';
    IF v_matches <> 1 THEN RETURN false; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM ifund_identity.owner_matches m
      WHERE m.source_user_id = v_candidate.source_user_id
        AND m.normalized_source_email = v_email
    ) THEN RETURN false; END IF;
  ELSIF v_candidate.proof_kind = 'legacy_email_otp' THEN
    -- Verified by an approved backend email sender to the source email on file.
    IF v_candidate.code_to_legacy_email_verified_at IS NULL
       OR v_candidate.code_to_legacy_email_verified_at < now() - interval '10 minutes'
    THEN RETURN false; END IF;
  ELSE RETURN false; END IF;

  UPDATE ifund_identity.owner_matches m
  SET status = 'linked', linked_auth_uid = p_authenticated_uid, updated_at = now()
  WHERE m.source_user_id = v_candidate.source_user_id
    AND m.status = 'awaiting_destination_login'
    AND m.linked_auth_uid IS NULL;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE ifund_identity.link_challenges
  SET consumed_at = now()
  WHERE challenge_hash = p_challenge_hash AND consumed_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'owner_link_nonce_replayed'; END IF;

  INSERT INTO ifund_identity.link_consent_audit
    (challenge_hash,source_user_id,destination_auth_uid,proof_kind)
  VALUES (p_challenge_hash,v_candidate.source_user_id,p_authenticated_uid,v_candidate.proof_kind);
  RETURN true;
END;
$claim$;
REVOKE ALL ON FUNCTION ifund_identity.claim_verified_owner(text,uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ifund_identity.claim_verified_owner(text,uuid)
TO service_role;

-- CRITICAL: no runtime route for this RPC is enabled until approval,
-- verified provider-email proof, challenge issuance, TTL/rate-limits,
-- fallback OTP delivery, and adversarial SQL integration tests.
