
BEGIN;

-- Public story access must be published-only. The previous predicate treated
-- auth.uid() IS NULL as permission to read every row, including drafts.
DROP POLICY IF EXISTS ifund_blog_entries_read_public_or_owner
  ON public.ifund_blog_entries;
CREATE POLICY ifund_blog_entries_read_published_or_owner
  ON public.ifund_blog_entries
  FOR SELECT TO anon, authenticated
  USING (
    status = 'published'
    OR (
      (SELECT auth.uid()) IS NOT NULL
      AND owner_auth_user_id = (SELECT auth.uid())
      AND (SELECT public.ifund_current_account_is_active())
    )
  );

-- Source UserBlog is publicly readable. Preserve that behavior, while
-- keeping the Supabase Auth owner UUID and migration metadata out of browser
-- SELECT grants below.
DROP POLICY IF EXISTS ifund_blogs_read_active_or_owner
  ON public.ifund_blogs;
CREATE POLICY ifund_blogs_read_public
  ON public.ifund_blogs
  FOR SELECT TO anon, authenticated
  USING (true);

-- Editorial writes must pass through a server-authorized service that checks
-- active-account state, paid membership, ownership, publication rules and
-- campaign embeds. Browser table writes bypass those source checks.
DROP POLICY IF EXISTS ifund_blog_entries_owner_insert
  ON public.ifund_blog_entries;
DROP POLICY IF EXISTS ifund_blog_entries_owner_update
  ON public.ifund_blog_entries;
DROP POLICY IF EXISTS ifund_blog_entries_owner_delete
  ON public.ifund_blog_entries;
DROP POLICY IF EXISTS ifund_blogs_owner_update
  ON public.ifund_blogs;
DROP POLICY IF EXISTS ifund_blogs_owner_delete
  ON public.ifund_blogs;

REVOKE ALL PRIVILEGES
  ON TABLE public.ifund_blogs, public.ifund_blog_entries
  FROM PUBLIC, anon, authenticated;

-- Remove existing column-level grants as well as table-level grants.
DO $revoke_editorial_columns$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('ifund_blogs', 'ifund_blog_entries')
  LOOP
    EXECUTE format(
      'REVOKE SELECT (%I), INSERT (%I), UPDATE (%I), REFERENCES (%I) ON TABLE public.%I FROM PUBLIC, anon, authenticated',
      item.column_name, item.column_name, item.column_name, item.column_name,
      item.table_name
    );
  END LOOP;
END;
$revoke_editorial_columns$;

-- Expose only source-equivalent public fields. The target Auth UUID,
-- migration creator metadata, source-system marker and migration timestamps
-- remain server-only.
GRANT SELECT (
  id, legacy_owner_user_id, type, title, description, slug,
  cover_image_url, status, created_at, updated_at
) ON TABLE public.ifund_blogs TO anon, authenticated;

GRANT SELECT (
  id, blog_id, legacy_owner_user_id, type, title, summary, body,
  status, featured, published_at, created_at, updated_at
) ON TABLE public.ifund_blog_entries TO anon, authenticated;

COMMIT;
