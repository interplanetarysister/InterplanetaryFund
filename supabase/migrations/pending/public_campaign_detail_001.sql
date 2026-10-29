-- PENDING: NOT APPLIED. Review, then apply to Supabase project tzehxfikoslihnclhxuz.
--
-- Public, read-only campaign detail RPC for the standalone public site (apps/web).
-- The frontend (apps/web/src/api/publicData.js) calls this first and falls back
-- to the list RPC if it is missing or errors.
--
-- Design:
--   * SECURITY DEFINER, STABLE, fixed search_path, read-only (no writes).
--   * Published campaigns only: rows come exclusively from the existing
--     public.ifund_migration_active_campaign_preview(...) function, which only
--     returns active campaigns. No owner, donor, payout, contact, or internal
--     fields are exposed.
--   * EXECUTE granted to anon (and authenticated); revoked from PUBLIC.
--
-- Follow-up (optional): once the source table behind the preview function is
-- confirmed, extend this function to also return the campaign story, location,
-- and funding totals from that table, keeping the same "active only" filter.
-- The frontend already renders those fields when present and hides them when
-- absent.

create or replace function public.ifund_public_campaign_detail(p_source_id text)
returns table (
  source_id text,
  title text,
  summary text,
  category text,
  cover_image_url text,
  preview_only boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.source_id::text,
    p.title::text,
    p.summary::text,
    p.category::text,
    p.cover_image_url::text,
    coalesce(p.preview_only, true)
  from public.ifund_migration_active_campaign_preview(
    p_after_source_id => null,
    p_limit => 10000
  ) as p
  where p_source_id is not null
    and p.source_id::text = p_source_id
  limit 1;
$$;

comment on function public.ifund_public_campaign_detail(text) is
  'Read-only public detail for one published (active) campaign, used by apps/web. Exposes no private fields.';

revoke all on function public.ifund_public_campaign_detail(text) from public;
grant execute on function public.ifund_public_campaign_detail(text) to anon, authenticated;
