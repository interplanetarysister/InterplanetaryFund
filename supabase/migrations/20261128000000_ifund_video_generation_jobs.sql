-- AI video generation jobs (Media Studio, Cloudflare Workers AI provider).
--
-- SOURCE ONLY — created 2026-11-28 with the video provider wiring
-- (worker/videoGeneration.js). NOT applied to production. Apply before
-- IFUND_VIDEO_AI_ENABLED is set to "enabled" anywhere; without this table
-- the Worker routes fail closed with an honest unavailable state.
--
-- One durable row per generation request. The Worker (service role) is the
-- only reader/writer: it records the finished provider result URL on the
-- job BEFORE attempting storage (state provider_completed), so a storage
-- failure can never silently discard a finished, allowance-charged
-- generation — Advance retries only the save. Allowance receipts live in
-- the shared AI content ledger (ifund_ai_content_reserve/complete with
-- kind 'video'); this table is the job/lifecycle record only.
create table if not exists public.ifund_video_generations (
 owner_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 provider text not null default 'cloudflare-workers-ai',
 model text not null,
 state text not null check(state in
   ('submitted','running','provider_pending','provider_completed','completed','failed')),
 prompt text not null check(char_length(prompt) between 20 and 900),
 resolution text not null check(resolution in ('480P','720P','1080P')),
 ratio text not null check(ratio in ('adaptive','16:9','9:16','1:1')),
 duration_seconds integer not null check(duration_seconds between 3 and 10),
 provider_job_id text,
 provider_video_url text,
 media_id uuid references public.ifund_member_media(id) on delete set null,
 allowance_tracked boolean not null default false,
 error text,
 created_at timestamptz not null default statement_timestamp(),
 updated_at timestamptz not null default statement_timestamp(),
 primary key(owner_id,request_id)
);
create index if not exists ifund_video_generations_owner_state
 on public.ifund_video_generations(owner_id,state,updated_at);
alter table public.ifund_video_generations enable row level security;
-- No browser access: the Worker mediates every read and write with the
-- service role after verifying the member, exactly like the paid AI
-- generation ledger. Members see their jobs only through the Worker API.
revoke all on public.ifund_video_generations from public,anon,authenticated;
