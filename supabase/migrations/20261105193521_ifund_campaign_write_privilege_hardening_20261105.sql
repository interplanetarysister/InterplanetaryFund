-- Applied on the canonical InterplanetaryFund project.
-- Preserve SELECT and DELETE table grants (RLS still constrains rows), while
-- restricting browser INSERT/UPDATE to explicitly client-owned columns.
BEGIN;

REVOKE INSERT, UPDATE
ON TABLE public.ifund_campaigns, public.ifund_posts
FROM authenticated;

GRANT INSERT (owner_id, title, summary, story, category, goal_amount, cover_image_url, status)
ON TABLE public.ifund_campaigns TO authenticated;

GRANT UPDATE (title, summary, story, category, goal_amount, cover_image_url, status)
ON TABLE public.ifund_campaigns TO authenticated;

GRANT INSERT (author_id, body)
ON TABLE public.ifund_posts TO authenticated;

COMMIT;
