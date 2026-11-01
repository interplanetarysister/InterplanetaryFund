
BEGIN;

-- Owner-scoped InboxItem access. Producers remain server-only; browser users
-- may read their own items and change only the source-supported draft/status.
DROP POLICY IF EXISTS ifund_inbox_items_browser_deny
  ON public.ifund_inbox_items;
CREATE POLICY ifund_inbox_items_owner_select
  ON public.ifund_inbox_items
  FOR SELECT TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    AND (SELECT public.ifund_current_account_is_active())
  );
CREATE POLICY ifund_inbox_items_owner_update
  ON public.ifund_inbox_items
  FOR UPDATE TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    AND (SELECT public.ifund_current_account_is_active())
  )
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND (SELECT public.ifund_current_account_is_active())
  );

REVOKE ALL PRIVILEGES
  ON TABLE public.ifund_inbox_items
  FROM PUBLIC, anon, authenticated;

DO $revoke_inbox_columns$
DECLARE item record;
BEGIN
  FOR item IN
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ifund_inbox_items'
  LOOP
    EXECUTE format(
      'REVOKE SELECT (%1$I), INSERT (%1$I), UPDATE (%1$I), REFERENCES (%1$I) ON TABLE public.ifund_inbox_items FROM PUBLIC, anon, authenticated',
      item.column_name
    );
  END LOOP;
END;
$revoke_inbox_columns$;

GRANT SELECT (
  id, owner_id, source_legacy_id, platform, campaign_id, campaign_title,
  canonical_operation_id, type, author, content, link, status, ai_draft,
  conversation_id, external_message_id, connection_id, reply_support,
  recipient_address, mailbox_priority, created_at, updated_at
) ON TABLE public.ifund_inbox_items TO authenticated;
GRANT UPDATE (status, ai_draft)
  ON TABLE public.ifund_inbox_items TO authenticated;

-- Notifications already have owner-only SELECT/UPDATE policies. Restore the
-- exact browser privileges required by the existing Notifications page:
-- owner-visible fields plus read acknowledgement only.
REVOKE ALL PRIVILEGES
  ON TABLE public.ifund_notifications
  FROM PUBLIC, anon, authenticated;

DO $revoke_notification_columns$
DECLARE item record;
BEGIN
  FOR item IN
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ifund_notifications'
  LOOP
    EXECUTE format(
      'REVOKE SELECT (%1$I), INSERT (%1$I), UPDATE (%1$I), REFERENCES (%1$I) ON TABLE public.ifund_notifications FROM PUBLIC, anon, authenticated',
      item.column_name
    );
  END LOOP;
END;
$revoke_notification_columns$;

GRANT SELECT (
  id, owner_id, title, body, type, link, read, created_at
) ON TABLE public.ifund_notifications TO authenticated;
GRANT UPDATE (read)
  ON TABLE public.ifund_notifications TO authenticated;

COMMIT;
