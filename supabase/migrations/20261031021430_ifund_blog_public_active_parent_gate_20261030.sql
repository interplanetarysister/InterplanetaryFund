
DROP POLICY IF EXISTS ifund_blog_entries_read_published_or_owner
  ON public.ifund_blog_entries;

CREATE POLICY ifund_blog_entries_read_published_or_owner
  ON public.ifund_blog_entries
  FOR SELECT TO anon, authenticated
  USING (
    (
      status = 'published'
      AND EXISTS (
        SELECT 1
        FROM public.ifund_blogs AS parent_blog
        WHERE parent_blog.id = ifund_blog_entries.blog_id
          AND parent_blog.status = 'active'
      )
    )
    OR (
      (SELECT auth.uid()) IS NOT NULL
      AND owner_auth_user_id = (SELECT auth.uid())
      AND (SELECT public.ifund_current_account_is_active())
    )
  );
