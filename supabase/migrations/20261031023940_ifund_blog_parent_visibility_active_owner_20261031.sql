
DROP POLICY IF EXISTS ifund_blogs_read_public
  ON public.ifund_blogs;

CREATE POLICY ifund_blogs_read_active_or_owner
  ON public.ifund_blogs
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'active'
    OR (
      (SELECT auth.uid()) IS NOT NULL
      AND owner_auth_user_id = (SELECT auth.uid())
      AND (SELECT public.ifund_current_account_is_active())
    )
  );

COMMENT ON POLICY ifund_blogs_read_active_or_owner
  ON public.ifund_blogs
  IS 'Public readers see active blogs only; active owners can also read their own archived blog.';
