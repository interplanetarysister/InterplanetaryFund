-- Video generation subject anchor: a named goal/plan as the generation's
-- subject when the video does not promote a fundraising campaign.
--
-- SOURCE ONLY — created 2026-11-28 with the media-anchor rule
-- (worker/videoGeneration.js). NOT applied to production. The Worker
-- enforces the rule in validateVideoRequest (a campaign_id or a goal
-- subject is required before any allowance is reserved), and it only
-- references these columns when a goal subject is supplied, so campaign
-- generations are unaffected until this migration is applied. Apply
-- before goal-subject video generation is used anywhere.
--
-- The owner's media-anchor rule: ALL media generation is attached to a
-- selected subject — a fundraising campaign OR a non-financial goal/plan
-- (members also make plans they want help promoting and implementing,
-- with no money goal) — and is prepared from that subject's context,
-- never context-free. Campaign subjects already record campaign_id
-- (migration 20261128010000). This migration adds the goal/plan anchor:
--   1. goal_title — the goal or plan the video promotes, as named by the
--      member. Together with goal_category it forms the PR #402 subject
--      fingerprint (normalized title + "|" + category) the Worker
--      computes when the request is validated.
--   2. goal_category — the goal's category, when the member gave one.
--   3. A subject CHECK (campaign_id or goal_title present) as the
--      data-layer backstop. NOT VALID on purpose: job rows created
--      before the anchor rule are not re-validated, while every new
--      row is checked.

alter table public.ifund_video_generations
  add column if not exists goal_title text;
alter table public.ifund_video_generations
  add column if not exists goal_category text;

alter table public.ifund_video_generations
  drop constraint if exists ifund_video_generations_subject_check;
alter table public.ifund_video_generations
  add constraint ifund_video_generations_subject_check
  check (campaign_id is not null or goal_title is not null) not valid;
