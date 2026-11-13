-- STAGED ONLY: do not apply until the complete site / preview release gate passes.
-- Read-only, bounded super-admin timeline from existing canonical event stores.
-- No inserted audit records, payment changes, provider configuration, or raw
-- details/actor identifiers disclosed to the browser.
--
-- Sources were catalog-verified in production on 2026-11-13:
-- ifund_ops.workflow_execution_log(id, event_type, event_at)
-- public.ifund_admin_mail_audit(id, action, occurred_at)
-- public.ifund_platform_incident(id, status, updated_at).
--
-- SECURITY: DEFINER is necessary because private ifund_ops records have no
-- authenticated table grants. A fresh server-verified super-admin check is
-- REQUIRED for every invocation, independent of caller JWT role metadata.
CREATE OR REPLACE FUNCTION public.ifund_super_admin_audit_feed(
  p_limit integer DEFAULT 50,
  p_before_at timestamptz DEFAULT NULL,
  p_before_id text DEFAULT NULL
)
RETURNS TABLE(
  event_id text,
  event_source text,
  event_name text,
  occurred_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR
     NOT COALESCE(public.ifund_current_user_is_verified_super_admin(), FALSE)
  THEN
    RAISE EXCEPTION 'Verified super administrator only' USING ERRCODE = '42501';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100
     OR ((p_before_at IS NULL) <> (p_before_id IS NULL))
     OR (p_before_id IS NOT NULL AND
         (length(p_before_id) < 1 OR length(p_before_id) > 160))
  THEN
    RAISE EXCEPTION 'Invalid audit page request' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT activity.event_id, activity.event_source,
         activity.event_name, activity.occurred_at
  FROM (
    SELECT ('workflow:' || md5(w.id::text)) AS event_id,
           'workflow'::text AS event_source,
           (CASE WHEN w.event_type IN ('queued', 'started', 'completed', 'failed', 'retry', 'skipped', 'success', 'error', 'dead_letter', 'blocked', 'delivered')
                 THEN w.event_type ELSE 'event recorded' END)::text AS event_name,
           w.event_at AS occurred_at
    FROM ifund_ops.workflow_execution_log AS w
    WHERE w.event_at IS NOT NULL

    UNION ALL

    SELECT ('mail:' || md5(m.id::text)),
           'administrative mail'::text,
           (CASE WHEN m.action IN ('read', 'unread', 'mark_read', 'mark_unread', 'received', 'sent', 'archived')
                 THEN m.action ELSE 'action recorded' END)::text,
           m.occurred_at
    FROM public.ifund_admin_mail_audit AS m
    WHERE m.occurred_at IS NOT NULL

    UNION ALL

    SELECT ('incident:' || md5(i.id::text)),
           'platform incident'::text,
           'incident updated'::text,
           i.updated_at
    FROM public.ifund_platform_incident AS i
    WHERE i.updated_at IS NOT NULL
  ) AS activity
  WHERE p_before_at IS NULL
     OR (activity.occurred_at, activity.event_id) <
        (p_before_at, p_before_id)
  ORDER BY activity.occurred_at DESC, activity.event_id DESC
  LIMIT p_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.ifund_super_admin_audit_feed(integer, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ifund_super_admin_audit_feed(integer, timestamptz, text)
  TO authenticated;
COMMENT ON FUNCTION public.ifund_super_admin_audit_feed(integer, timestamptz, text) IS
'Verified super-admin-only read of bounded operational audit timestamps and types; no raw mail, workflow details, incident notes, user identifiers, or payment data.';
