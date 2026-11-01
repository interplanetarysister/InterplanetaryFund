
ALTER TABLE public.ifund_blogs
  ALTER COLUMN legacy_owner_user_id DROP NOT NULL;

ALTER TABLE public.ifund_blog_entries
  ALTER COLUMN legacy_owner_user_id DROP NOT NULL;

COMMENT ON COLUMN public.ifund_blogs.legacy_owner_user_id IS
  'Original Base44 owner identifier. NULL is correct for accounts created natively in Supabase.';
COMMENT ON COLUMN public.ifund_blog_entries.legacy_owner_user_id IS
  'Original Base44 owner identifier. NULL is correct for entries created natively in Supabase.';

CREATE UNIQUE INDEX IF NOT EXISTS ifund_blogs_one_member_per_owner
  ON public.ifund_blogs(owner_auth_user_id)
  WHERE type = 'member';

CREATE OR REPLACE FUNCTION public.ifund_blog_author_entitled(p_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT (
    SELECT count(*) = 1
    FROM ifund_finance.pay_pal_subscription_intent AS intent
    JOIN ifund_finance.subscription_plan_mapping AS plan
      ON plan.provider = 'paypal'
      AND plan.account_ref = 'interplanetary_business_paypal'
      AND plan.tier = intent.tier
      AND plan."interval" = intent."interval"
      AND plan.plan_id = intent.plan_id
      AND plan.currency = 'USD'
      AND plan.catalog_version = '2026-10-v1'
      AND plan.verified_at IS NOT NULL
      AND btrim(plan.verified_at) <> ''
      AND plan.amount_cents = CASE intent.tier
        WHEN 'basic' THEN CASE intent."interval" WHEN 'monthly' THEN 1200 WHEN 'annual' THEN 11500 END
        WHEN 'outreach' THEN CASE intent."interval" WHEN 'monthly' THEN 4900 WHEN 'annual' THEN 47000 END
        WHEN 'professional' THEN CASE intent."interval" WHEN 'monthly' THEN 9900 WHEN 'annual' THEN 95000 END
        WHEN 'enterprise' THEN CASE intent."interval" WHEN 'monthly' THEN 19900 WHEN 'annual' THEN 191000 END
        WHEN 'nonprofit' THEN CASE intent."interval" WHEN 'monthly' THEN 2900 WHEN 'annual' THEN 28000 END
      END
    WHERE p_owner_id IS NOT NULL
      AND intent.owner_auth_uid = p_owner_id
      AND intent.account_ref = 'interplanetary_business_paypal'
      AND intent.status = 'active'
      AND intent.last_verified_at IS NOT NULL
      AND intent.last_verified_at <= now()
      AND (intent.last_reversal_at IS NULL OR intent.last_reversal_at < intent.last_verified_at)
      AND intent.paypal_subscription_id ~ '^I-[A-Z0-9]{10,30}$'
      AND intent.tier IN ('basic', 'outreach', 'professional', 'enterprise', 'nonprofit')
      AND intent."interval" IN ('monthly', 'annual')
  );
$function$;

REVOKE ALL ON FUNCTION public.ifund_blog_author_entitled(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ifund_blog_author_entitled(uuid)
  TO service_role;
