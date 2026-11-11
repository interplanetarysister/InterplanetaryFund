-- Manual iFund PayPal Hackathon tracker; financial tables and feature gates are untouched.
create table if not exists public.ifund_hackathon_demo_steps (
  step_key text primary key check (step_key ~ '^[a-z0-9-]{3,64}$'),
  status text not null default 'unknown' check (status in ('unknown','pending','blocked','completed')),
  evidence_links jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_links) = 'array'),
  screenshot_links jsonb not null default '[]'::jsonb check (jsonb_typeof(screenshot_links) = 'array'),
  test_result text not null default '' check (char_length(test_result) <= 8000),
  blocker text not null default '' check (char_length(blocker) <= 4000),
  next_action text not null default '' check (char_length(next_action) <= 4000),
  commit_sha text not null default '' check (commit_sha = '' or commit_sha ~ '^[0-9a-f]{7,40}$'),
  preview_url text not null default '' check (char_length(preview_url) <= 2000),
  deployment_notes text not null default '' check (char_length(deployment_notes) <= 8000),
  checked_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid not null default auth.uid(),
  revision integer not null default 1 check (revision >= 1)
);
alter table public.ifund_hackathon_demo_steps enable row level security;
revoke all on public.ifund_hackathon_demo_steps from PUBLIC, anon, authenticated;
grant select,insert,update on public.ifund_hackathon_demo_steps to authenticated;
drop policy if exists ifund_hackathon_tracker_select on public.ifund_hackathon_demo_steps;
drop policy if exists ifund_hackathon_tracker_insert on public.ifund_hackathon_demo_steps;
drop policy if exists ifund_hackathon_tracker_update on public.ifund_hackathon_demo_steps;
create policy ifund_hackathon_tracker_select on public.ifund_hackathon_demo_steps
  for select to authenticated
  using ((select public.ifund_current_user_is_verified_super_admin()));
create policy ifund_hackathon_tracker_insert on public.ifund_hackathon_demo_steps
  for insert to authenticated
  with check ((select public.ifund_current_user_is_verified_super_admin()) and updated_by = (select auth.uid()));
create policy ifund_hackathon_tracker_update on public.ifund_hackathon_demo_steps
  for update to authenticated
  using ((select public.ifund_current_user_is_verified_super_admin()))
  with check ((select public.ifund_current_user_is_verified_super_admin()) and updated_by = (select auth.uid()));
comment on table public.ifund_hackathon_demo_steps is 'Admin-only manual evidence and status records for existing PayPal sandbox hackathon; no financial authority.';
