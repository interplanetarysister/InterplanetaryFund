
-- IFund notifications and owner inbox foundation.
-- Non-destructive: creates new tables only; no historical rows are imported.
-- All notification writes and all InboxItem writes remain server-controlled.
BEGIN;

-- Public objects created by postgres must not inherit browser-wide privileges.
-- supabase_admin defaults are intentionally not altered: the connected postgres
-- role is not a member of supabase_admin.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

CREATE TABLE public.ifund_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 240),
  body text CHECK (body IS NULL OR length(body) <= 4000),
  type text NOT NULL DEFAULT 'system'
    CHECK (type IN ('donation','update','thank_you','announcement','milestone','system')),
  link text CHECK (link IS NULL OR length(link) <= 512),
  read boolean NOT NULL DEFAULT false,
  canonical_operation_id text CHECK (
    canonical_operation_id IS NULL OR length(canonical_operation_id) <= 256
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ifund_notifications_canonical_operation_uidx
  ON public.ifund_notifications (canonical_operation_id)
  WHERE canonical_operation_id IS NOT NULL;
CREATE INDEX ifund_notifications_owner_created_idx
  ON public.ifund_notifications (owner_id, created_at DESC);
CREATE INDEX ifund_notifications_owner_unread_idx
  ON public.ifund_notifications (owner_id, created_at DESC)
  WHERE read = false;

ALTER TABLE public.ifund_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY ifund_notifications_owner_select
  ON public.ifund_notifications FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));

CREATE POLICY ifund_notifications_owner_acknowledge
  ON public.ifund_notifications FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.ifund_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, owner_id, title, body, type, link, read, created_at)
  ON TABLE public.ifund_notifications TO authenticated;
GRANT UPDATE (read)
  ON TABLE public.ifund_notifications TO authenticated;
GRANT ALL ON TABLE public.ifund_notifications TO service_role;

COMMENT ON TABLE public.ifund_notifications IS
  'Owner-scoped IFund notices; distinct from payment ledger rows and external provider messages. Browser users may read their own notices and acknowledge read state only. Trusted services create notices.';

CREATE TABLE public.ifund_inbox_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_legacy_id text CHECK (source_legacy_id IS NULL OR length(source_legacy_id) <= 200),
  platform text NOT NULL CHECK (length(platform) BETWEEN 1 AND 80),
  campaign_id uuid REFERENCES public.ifund_campaigns(id) ON DELETE SET NULL,
  campaign_title text CHECK (campaign_title IS NULL OR length(campaign_title) <= 240),
  canonical_operation_id text CHECK (
    canonical_operation_id IS NULL OR length(canonical_operation_id) <= 256
  ),
  type text NOT NULL DEFAULT 'system'
    CHECK (type IN ('comment','message','donation','mention','reply','question','system')),
  author text CHECK (author IS NULL OR length(author) <= 200),
  content text NOT NULL DEFAULT '' CHECK (length(content) <= 12000),
  link text CHECK (link IS NULL OR length(link) <= 2048),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
  ai_draft text CHECK (ai_draft IS NULL OR length(ai_draft) <= 10000),
  conversation_id text CHECK (conversation_id IS NULL OR length(conversation_id) <= 200),
  external_message_id text CHECK (external_message_id IS NULL OR length(external_message_id) <= 512),
  connection_id text CHECK (connection_id IS NULL OR length(connection_id) <= 200),
  reply_support text NOT NULL DEFAULT 'unknown'
    CHECK (reply_support IN ('unknown','native_verified','external_link','unsupported')),
  recipient_address text CHECK (recipient_address IS NULL OR length(recipient_address) <= 254),
  mailbox_priority text CHECK (mailbox_priority IS NULL OR mailbox_priority IN ('priority','normal')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, source_legacy_id)
);

CREATE UNIQUE INDEX ifund_inbox_items_canonical_operation_uidx
  ON public.ifund_inbox_items (canonical_operation_id)
  WHERE canonical_operation_id IS NOT NULL;
CREATE UNIQUE INDEX ifund_inbox_items_external_message_uidx
  ON public.ifund_inbox_items (owner_id, platform, connection_id, external_message_id)
  WHERE connection_id IS NOT NULL AND external_message_id IS NOT NULL;
CREATE INDEX ifund_inbox_items_owner_created_idx
  ON public.ifund_inbox_items (owner_id, created_at DESC);
CREATE INDEX ifund_inbox_items_owner_status_created_idx
  ON public.ifund_inbox_items (owner_id, status, created_at DESC);

ALTER TABLE public.ifund_inbox_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY ifund_inbox_items_browser_deny
  ON public.ifund_inbox_items FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.ifund_inbox_items FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ifund_inbox_items TO service_role;

COMMENT ON TABLE public.ifund_inbox_items IS
  'Owner-scoped Universal Inbox event summaries. Browser access is denied; authenticated Worker handlers enforce owner scope and controlled updates. This table does not grant provider reply capability.';

COMMIT;
