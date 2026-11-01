BEGIN;

CREATE OR REPLACE FUNCTION public.ifund_my_post_ids()
RETURNS TABLE(post_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT p.id
  FROM public.ifund_posts AS p
  WHERE auth.uid() IS NOT NULL
    AND p.author_id = auth.uid()
    AND public.ifund_current_account_is_active() IS TRUE
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT 500;
$function$;

REVOKE ALL ON FUNCTION public.ifund_my_post_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ifund_my_post_ids() TO authenticated;

COMMENT ON FUNCTION public.ifund_my_post_ids() IS
  'Returns only the current active authenticated owner''s community post IDs; no author identifiers or post content are exposed.';

COMMIT;