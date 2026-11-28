-- Concierge video provider: brief + campaign reference on the jobs table,
-- the pickup-ready state, and a trusted service-role allowance completion.
--
-- SOURCE ONLY — created 2026-11-28 with the executive-concierge provider
-- wiring (worker/videoGeneration.js). NOT applied to production. Apply
-- before IFUND_VIDEO_PROVIDER=executive-concierge is enabled anywhere;
-- without this migration the concierge routes fail closed (the state
-- check rejects 'awaiting_concierge' and the brief/campaign columns do
-- not exist), while the provider routes are unaffected because they never
-- reference the new columns or state.
--
-- Additive follow-up to 20261128000000_ifund_video_generation_jobs.sql:
--   1. campaign_id — the campaign a generation was requested for (the
--      concierge brief is built from that campaign's own context). Set
--      null if the campaign is later deleted; the job record stays.
--   2. brief — the generation brief the Worker assembled server-side from
--      the campaign context + the member's direction, already passed
--      through the public-facing discretion scan. Returned only through
--      the secret-authenticated concierge pickup endpoint, never through
--      the member job API.
--   3. state 'awaiting_concierge' — the pickup-ready state: the job is
--      reserved and briefed, waiting for the external concierge agent to
--      pick it up and return a finished video.
--   4. ifund_ai_content_complete_for_owner — the allowance completion
--      the concierge return path needs. The existing completion RPCs
--      read the owner from auth.uid(), but the concierge completion
--      endpoint is authenticated by a shared secret and holds no member
--      JWT, so it cannot call them. This function mirrors
--      public.ifund_ai_content_complete exactly, with the owner supplied
--      by the trusted caller instead of auth.uid(). It is granted to the
--      service role ONLY: the Worker calls it after the pickup secret
--      verified the returning agent AND the job row (read with the
--      service role) proved which owner the request reference belongs
--      to. Never grant it to authenticated — a browser caller could
--      otherwise complete other members' reservations.
alter table public.ifund_video_generations
  add column if not exists campaign_id uuid
    references public.ifund_campaigns(id) on delete set null;
alter table public.ifund_video_generations
  add column if not exists brief text;
alter table public.ifund_video_generations
  drop constraint if exists ifund_video_generations_brief_check;
alter table public.ifund_video_generations
  add constraint ifund_video_generations_brief_check
  check (brief is null or char_length(brief) between 1 and 4000);
alter table public.ifund_video_generations
  drop constraint if exists ifund_video_generations_state_check;
alter table public.ifund_video_generations
  add constraint ifund_video_generations_state_check
  check (state in ('submitted','running','provider_pending',
    'provider_completed','awaiting_concierge','completed','failed'));
create index if not exists ifund_video_generations_concierge_queue
  on public.ifund_video_generations(created_at)
  where provider = 'executive-concierge' and state = 'awaiting_concierge';

create or replace function public.ifund_ai_content_complete_for_owner(
  p_owner_id uuid, p_request_id uuid, p_kind text)
returns boolean language plpgsql volatile security definer
set search_path='' set row_security='off'
as $body$
begin
 if p_owner_id is null or p_request_id is null or p_kind is null
   then raise exception 'Invalid completion reference' using errcode='22023'; end if;
 if exists(select 1 from public.ifund_paid_ai_generations
    where owner_id=p_owner_id and request_id=p_request_id and kind=p_kind) then
   update public.ifund_paid_ai_generations
    set state='completed',completed_at=statement_timestamp(),reserved_until=null
    where owner_id=p_owner_id and request_id=p_request_id and kind=p_kind
      and state='reserved' and reserved_until>statement_timestamp();
   if found then return true; end if;
   return exists(select 1 from public.ifund_paid_ai_generations
    where owner_id=p_owner_id and request_id=p_request_id and kind=p_kind
      and state='completed');
 end if;
 -- Trial/shared-pool branch: the same update
 -- public.ifund_trial_ai_generation_complete performs, with the owner
 -- supplied by the trusted caller instead of auth.uid().
 update public.ifund_trial_ai_generations
  set state='completed',completed_at=statement_timestamp(),reserved_until=null
  where owner_id=p_owner_id and request_id=p_request_id and kind=p_kind
   and state='reserved' and reserved_until>statement_timestamp();
 if found then return true; end if;
 return exists(select 1 from public.ifund_trial_ai_generations
  where owner_id=p_owner_id and request_id=p_request_id and kind=p_kind
   and state='completed');
end $body$;

revoke all on function public.ifund_ai_content_complete_for_owner(uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.ifund_ai_content_complete_for_owner(uuid,uuid,text)
  to service_role;
