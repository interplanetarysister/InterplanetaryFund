-- Review in staging before applying to production. Non-destructive initial schema.
-- Existing unrelated Supabase tables are deliberately untouched.
create extension if not exists pgcrypto;
create table if not exists public.ifund_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,
  display_name text,
  created_at timestamptz not null default now(),
  constraint ifund_handle_format check (handle is null or handle ~ '^[A-Za-z0-9_-]{3,32}$')
);
create table if not exists public.ifund_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  title text not null default '',
  summary text not null default '',
  story text not null default '',
  category text not null default 'community',
  goal_amount numeric(14,2) not null default 0 check (goal_amount >= 0),
  cover_image_url text not null default '',
  status text not null default 'draft' check (status in ('draft','active','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ifund_publish_complete check (status <> 'active' or (length(trim(title))>0 and length(trim(summary))>0 and length(trim(story))>0 and goal_amount>0))
);
create table if not exists public.ifund_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create table if not exists public.ifund_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  provider text not null,
  status text not null default 'disconnected' check (status in ('disconnected','pending','connected','error')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique(owner_id,provider)
);
create index if not exists ifund_campaigns_public_recent on public.ifund_campaigns(status,created_at desc);
create index if not exists ifund_campaigns_owner_recent on public.ifund_campaigns(owner_id,created_at desc);
create index if not exists ifund_posts_recent on public.ifund_posts(created_at desc);
alter table public.ifund_profiles enable row level security;
alter table public.ifund_campaigns enable row level security;
alter table public.ifund_posts enable row level security;
alter table public.ifund_connections enable row level security;
create policy ifund_profiles_read on public.ifund_profiles for select to authenticated using (id = (select auth.uid()));
create policy ifund_profiles_insert on public.ifund_profiles for insert to authenticated with check (id = (select auth.uid()));
create policy ifund_profiles_update on public.ifund_profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy ifund_campaigns_public_read on public.ifund_campaigns for select to anon,authenticated using (status = 'active' or owner_id = (select auth.uid()));
create policy ifund_campaigns_insert on public.ifund_campaigns for insert to authenticated with check (owner_id = (select auth.uid()));
create policy ifund_campaigns_update on public.ifund_campaigns for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy ifund_campaigns_delete on public.ifund_campaigns for delete to authenticated using (owner_id = (select auth.uid()));
create policy ifund_posts_public_read on public.ifund_posts for select to anon,authenticated using (true);
create policy ifund_posts_insert on public.ifund_posts for insert to authenticated with check (author_id = (select auth.uid()));
create policy ifund_posts_delete on public.ifund_posts for delete to authenticated using (author_id = (select auth.uid()));
create policy ifund_connections_owner_read on public.ifund_connections for select to authenticated using (owner_id = (select auth.uid()));
-- Only a trusted backend may mark a provider as connected after live verification.
-- No public insert/update policies for connections.
-- Remove any broad table grants supplied by Supabase defaults or older preview
-- schema revisions before applying the explicit least-privilege grants below.
-- RLS is still required: GRANT restricts columns, RLS restricts rows.
revoke all privileges on table
  public.ifund_profiles,
  public.ifund_campaigns,
  public.ifund_posts,
  public.ifund_connections
  from public, anon, authenticated;

grant usage on schema public to anon,authenticated;
grant select on public.ifund_campaigns,public.ifund_posts to anon;
-- Limit client-side writes to specific user-owned fields.
-- Timestamps, generated IDs, provider verification, roles, and ledger fields
-- are database/server-owned; exposed browsers cannot supply them.
grant select,delete on public.ifund_campaigns to authenticated;
grant insert(owner_id,title,summary,story,category,goal_amount,cover_image_url,status)
  on public.ifund_campaigns to authenticated;
grant update(title,summary,story,category,goal_amount,cover_image_url,status)
  on public.ifund_campaigns to authenticated;
grant select,delete on public.ifund_posts to authenticated;
grant insert(author_id,body) on public.ifund_posts to authenticated;
grant select on public.ifund_profiles to authenticated;
grant insert(id,handle,display_name) on public.ifund_profiles to authenticated;
grant update(handle,display_name) on public.ifund_profiles to authenticated;
grant select on public.ifund_connections to authenticated;

-- Timestamp maintenance; no live SQL was executed.
create or replace function public.ifund_touch_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists ifund_campaigns_touch_updated_at on public.ifund_campaigns;
create trigger ifund_campaigns_touch_updated_at before update on public.ifund_campaigns
for each row execute function public.ifund_touch_updated_at();
