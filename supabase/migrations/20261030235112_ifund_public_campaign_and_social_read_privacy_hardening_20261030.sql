
BEGIN;

-- Anonymous campaign reads remain active-only, but do not expose the Auth
-- owner UUID. The existing publicData.js selects only these public fields.
REVOKE SELECT ON TABLE public.ifund_campaigns FROM PUBLIC, anon;
DO $revoke_campaign_public_columns$
DECLARE item record;
BEGIN
  FOR item IN
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ifund_campaigns'
  LOOP
    EXECUTE format(
      'REVOKE SELECT (%1$I) ON TABLE public.ifund_campaigns FROM PUBLIC, anon',
      item.column_name
    );
  END LOOP;
END;
$revoke_campaign_public_columns$;
GRANT SELECT (
  id, title, summary, story, category, goal_amount,
  cover_image_url, status, created_at
) ON TABLE public.ifund_campaigns TO anon;

-- Public active campaigns must remain readable by authenticated users even
-- when their account lifecycle is not yet verified. Private owner/donor
-- campaign visibility still requires an active account.
DROP POLICY IF EXISTS ifund_campaigns_authenticated_read
  ON public.ifund_campaigns;
CREATE POLICY ifund_campaigns_authenticated_read
  ON public.ifund_campaigns
  FOR SELECT TO authenticated
  USING (
    status = 'active'
    OR (
      (SELECT public.ifund_current_account_is_active())
      AND (
        owner_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.ifund_donations d
          WHERE d.campaign_id = ifund_campaigns.id
            AND d.donor_id = (SELECT auth.uid())
            AND d.status = 'captured'
        )
      )
    )
  );

-- SocialPost is public-read in the source. Preserve public content access for
-- anon and authenticated users, while never exposing the target Supabase Auth
-- UUID used as author_id. The current target feed does not render that field;
-- its query must select id, body and created_at only.
DROP POLICY IF EXISTS ifund_posts_public_read ON public.ifund_posts;
CREATE POLICY ifund_posts_public_read
  ON public.ifund_posts
  FOR SELECT TO anon, authenticated
  USING (true);

REVOKE SELECT ON TABLE public.ifund_posts FROM PUBLIC, anon, authenticated;
DO $revoke_post_public_columns$
DECLARE item record;
BEGIN
  FOR item IN
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ifund_posts'
  LOOP
    EXECUTE format(
      'REVOKE SELECT (%1$I) ON TABLE public.ifund_posts FROM PUBLIC, anon, authenticated',
      item.column_name
    );
  END LOOP;
END;
$revoke_post_public_columns$;
GRANT SELECT (id, body, created_at)
  ON TABLE public.ifund_posts TO anon, authenticated;

COMMIT;
