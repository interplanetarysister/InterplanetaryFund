-- Import only owner-mapped, verified, non-financial historical notifications.
-- 90 source notifications are mapped to 3 verified Auth owners; 6 remain
-- unmapped and 1 donation notification is withheld because the source donation
-- cannot be reconciled to the canonical captured-donation ledger.
-- Source staging rows remain unchanged. This migration is idempotent by both
-- source UUID and deterministic canonical_operation_id.
BEGIN;

DO $preflight$
DECLARE
  v_total integer;
  v_mapped integer;
  v_eligible integer;
  v_unmapped integer;
  v_donation integer;
  v_existing integer;
BEGIN
  SELECT count(*) INTO v_total
  FROM ifund_stage.notification;

  SELECT count(*) INTO v_mapped
  FROM ifund_stage.notification n
  JOIN ifund_transfer.owner_identity_map m
    ON m.source_owner_id=n.user_id
   AND m.destination_auth_uid=n.owner_auth_uid
   AND m.verification_state='verified'
   AND m.candidate_match_method='confirmed_exact_email'
  JOIN auth.users a ON a.id=n.owner_auth_uid
  JOIN public.ifund_profiles p ON p.id=n.owner_auth_uid
  WHERE n.source_is_sample IS FALSE
    AND a.email_confirmed_at IS NOT NULL
    AND p.account_status='active'
    AND p.account_deletion_pending IS FALSE;

  SELECT count(*) INTO v_eligible
  FROM ifund_stage.notification n
  JOIN ifund_transfer.owner_identity_map m
    ON m.source_owner_id=n.user_id
   AND m.destination_auth_uid=n.owner_auth_uid
   AND m.verification_state='verified'
   AND m.candidate_match_method='confirmed_exact_email'
  JOIN auth.users a ON a.id=n.owner_auth_uid
  JOIN public.ifund_profiles p ON p.id=n.owner_auth_uid
  WHERE n.source_is_sample IS FALSE
    AND n.type <> 'donation'
    AND a.email_confirmed_at IS NOT NULL
    AND p.account_status='active'
    AND p.account_deletion_pending IS FALSE
    AND n.id IS NOT NULL
    AND n.legacy_id IS NOT NULL AND btrim(n.legacy_id)<>''
    AND n.source_digest_sha256 IS NOT NULL
    AND n.source_created_at IS NOT NULL
    AND n.title IS NOT NULL AND length(n.title) BETWEEN 1 AND 240
    AND (n.body IS NULL OR length(n.body)<=4000)
    AND (n.link IS NULL OR (
      length(n.link)<=512
      AND n.link LIKE '/%'
      AND n.link NOT LIKE '//%'
      AND n.link !~ '[\\\\[:cntrl:]]'
    ))
    AND n.type IN ('update','thank_you','announcement','milestone','system');

  SELECT count(*) INTO v_unmapped
  FROM ifund_stage.notification
  WHERE owner_auth_uid IS NULL;

  SELECT count(*) INTO v_donation
  FROM ifund_stage.notification
  WHERE type='donation';

  SELECT count(*) INTO v_existing
  FROM public.ifund_notifications;

  IF v_total <> 96 OR v_mapped <> 90 OR v_eligible <> 89
     OR v_unmapped <> 6 OR v_donation <> 1 OR v_existing <> 0 THEN
    RAISE EXCEPTION
      'Notification import preflight mismatch: total %, verified mapped %, eligible %, unmapped %, donation %, target existing %.',
      v_total, v_mapped, v_eligible, v_unmapped, v_donation, v_existing;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM ifund_stage.notification
    WHERE source_is_sample IS DISTINCT FROM FALSE
       OR source_digest_sha256 IS NULL
       OR title IS NULL OR length(title) NOT BETWEEN 1 AND 240
       OR (body IS NOT NULL AND length(body)>4000)
       OR (link IS NOT NULL AND (
          length(link)>512 OR link NOT LIKE '/%' OR link LIKE '//%'
          OR link ~ '[\\\\[:cntrl:]]'
       ))
       OR type NOT IN ('donation','update','thank_you','announcement','milestone','system')
  ) THEN
    RAISE EXCEPTION 'Source notification sample, content, link, or type validation failed.';
  END IF;
END;
$preflight$;

INSERT INTO public.ifund_notifications (
  id, owner_id, title, body, type, link, read,
  canonical_operation_id, created_at
)
SELECT
  n.id,
  n.owner_auth_uid,
  n.title,
  n.body,
  n.type,
  n.link,
  n.read,
  'base44:notification:' || n.legacy_id,
  n.source_created_at
FROM ifund_stage.notification n
JOIN ifund_transfer.owner_identity_map m
  ON m.source_owner_id=n.user_id
 AND m.destination_auth_uid=n.owner_auth_uid
 AND m.verification_state='verified'
 AND m.candidate_match_method='confirmed_exact_email'
JOIN auth.users a ON a.id=n.owner_auth_uid
JOIN public.ifund_profiles p ON p.id=n.owner_auth_uid
WHERE n.source_is_sample IS FALSE
  AND n.type <> 'donation'
  AND a.email_confirmed_at IS NOT NULL
  AND p.account_status='active'
  AND p.account_deletion_pending IS FALSE
  AND n.id IS NOT NULL
  AND n.legacy_id IS NOT NULL AND btrim(n.legacy_id)<>''
  AND n.source_digest_sha256 IS NOT NULL
  AND n.source_created_at IS NOT NULL
  AND n.title IS NOT NULL AND length(n.title) BETWEEN 1 AND 240
  AND (n.body IS NULL OR length(n.body)<=4000)
  AND (n.link IS NULL OR (
    length(n.link)<=512
    AND n.link LIKE '/%'
    AND n.link NOT LIKE '//%'
    AND n.link !~ '[\\\\[:cntrl:]]'
  ))
  AND n.type IN ('update','thank_you','announcement','milestone','system')
ON CONFLICT DO NOTHING;

DO $postflight$
DECLARE
  v_imported integer;
  v_expected integer;
  v_mismatches integer;
BEGIN
  SELECT count(*) INTO v_expected
  FROM ifund_stage.notification n
  JOIN ifund_transfer.owner_identity_map m
    ON m.source_owner_id=n.user_id
   AND m.destination_auth_uid=n.owner_auth_uid
   AND m.verification_state='verified'
   AND m.candidate_match_method='confirmed_exact_email'
  JOIN auth.users a ON a.id=n.owner_auth_uid
  JOIN public.ifund_profiles p ON p.id=n.owner_auth_uid
  WHERE n.source_is_sample IS FALSE
    AND n.type <> 'donation'
    AND a.email_confirmed_at IS NOT NULL
    AND p.account_status='active'
    AND p.account_deletion_pending IS FALSE;

  SELECT count(*) INTO v_imported
  FROM public.ifund_notifications
  WHERE canonical_operation_id LIKE 'base44:notification:%';

  SELECT count(*) INTO v_mismatches
  FROM ifund_stage.notification n
  JOIN ifund_transfer.owner_identity_map m
    ON m.source_owner_id=n.user_id
   AND m.destination_auth_uid=n.owner_auth_uid
   AND m.verification_state='verified'
   AND m.candidate_match_method='confirmed_exact_email'
  JOIN auth.users a ON a.id=n.owner_auth_uid
  JOIN public.ifund_profiles p ON p.id=n.owner_auth_uid
  LEFT JOIN public.ifund_notifications t
    ON t.id=n.id
   AND t.canonical_operation_id='base44:notification:' || n.legacy_id
  WHERE n.source_is_sample IS FALSE
    AND n.type <> 'donation'
    AND a.email_confirmed_at IS NOT NULL
    AND p.account_status='active'
    AND p.account_deletion_pending IS FALSE
    AND (
      t.id IS NULL
      OR t.owner_id IS DISTINCT FROM n.owner_auth_uid
      OR t.title IS DISTINCT FROM n.title
      OR t.body IS DISTINCT FROM n.body
      OR t.type IS DISTINCT FROM n.type
      OR t.link IS DISTINCT FROM n.link
      OR t.read IS DISTINCT FROM n.read
      OR t.created_at IS DISTINCT FROM n.source_created_at
    );

  IF v_expected <> 89 OR v_imported <> 89 OR v_mismatches <> 0 THEN
    RAISE EXCEPTION
      'Notification import postflight mismatch: expected %, imported %, mismatched source rows %.',
      v_expected, v_imported, v_mismatches;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ifund_notifications
    WHERE canonical_operation_id LIKE 'base44:notification:%'
      AND canonical_operation_id LIKE '%'
      AND type='donation'
  ) THEN
    RAISE EXCEPTION 'A donation notification was imported without ledger reconciliation.';
  END IF;
END;
$postflight$;

COMMENT ON TABLE public.ifund_notifications IS
  'Owner-scoped notifications. Historical Base44 imports use canonical_operation_id=base44:notification:<legacy_id>; financial donation alerts are withheld until matched to verified captured ledger records.';

COMMIT;