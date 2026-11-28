-- D6 repair + live-drift reconciliation (2026-11-27).
--
-- Live defect: an owner could publish a campaign (draft -> active) but could
-- never pause it (active -> paused); the UI reported "The campaign status
-- change was not saved." Two live-only database objects caused it, neither
-- present in this repo's migration history (verified against the live
-- pg_policies / pg_proc catalogs on 2026-11-27):
--
-- 1. Policy public.ifund_campaigns_update (live definition) required the
--    post-update row to satisfy status in ('draft','active') in its
--    WITH CHECK, omitting 'paused' — so every pause, and every content edit
--    of an already-paused campaign, violated row-level security.
-- 2. Trigger function public.ifund_guard_campaign_status_transition()
--    raised 'campaign_status_transition_requires_review' (42501) whenever a
--    non-service role set status to 'paused' or 'completed', with no owner
--    carve-out. Because the UPDATE policy is owner-only, that clause only
--    ever fired on owners pausing their own campaigns — the exact action
--    the product lifecycle (apps/web/src/lib/campaignLifecycle.js:
--    active -> paused) and the My Campaigns Pause button expose.
--
-- This migration records both objects as they exist live, with only the two
-- corrections that restore owner pause: 'paused' joins the WITH CHECK status
-- list, and the guard allows the campaign's owner (auth.uid() = old.owner_id)
-- to set 'paused'. Every other live condition is preserved: the owner,
-- account-active and current-terms gates, the published -> draft
-- prohibition, and the review requirement for 'completed' and for non-owner
-- callers. The managed-campaign guards are unrelated and untouched.

drop policy if exists ifund_campaigns_update on public.ifund_campaigns;
create policy ifund_campaigns_update on public.ifund_campaigns
  for update to authenticated
  using (
    (owner_id = (select auth.uid()))
    and (select public.ifund_current_account_is_active())
    and (select public.ifund_current_user_has_current_terms())
  )
  with check (
    (owner_id = (select auth.uid()))
    and (status = any (array['draft'::text, 'active'::text, 'paused'::text]))
    and (select public.ifund_current_account_is_active())
    and (select public.ifund_current_user_has_current_terms())
  );

create or replace function public.ifund_guard_campaign_status_transition()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if old.status in ('active', 'paused', 'completed') and new.status = 'draft' then
    raise exception 'A published campaign cannot be returned to draft.'
      using errcode = 'check_violation';
  end if;
  if current_user not in ('service_role', 'postgres', 'supabase_admin')
     and new.status in ('paused', 'completed')
     and not (new.status = 'paused' and auth.uid() is not null and auth.uid() = old.owner_id) then
    raise exception 'campaign_status_transition_requires_review'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists ifund_campaign_status_transition_guard on public.ifund_campaigns;
create trigger ifund_campaign_status_transition_guard
  before update on public.ifund_campaigns
  for each row execute function public.ifund_guard_campaign_status_transition();
