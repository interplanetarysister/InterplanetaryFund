-- REVIEW ONLY. Do not apply to production without owner approval, independent security review, and staging tests.
-- Independent IFund preview tables; does not touch ifund_ops or payment ledgers.
create table if not exists public.ifund_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  title text not null default '',
  summary text not null default '',
  story text not null default '',
  category text not null default 'community',
  goal_amount numeric(14,2) not null default 0 check (goal_amount >= 0),
  cover_image_url text not null default '',
  status text not null default 'draft' check (status in ('draft','active')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ifund_campaign_publish_required check (
    status = 'draft' or
    (length(btrim(title)) > 0 and length(btrim(summary)) > 0 and length(btrim(story)) > 0 and goal_amount > 0)
  )
);
create index if not exists ifund_campaigns_owner_created_idx on public.ifund_campaigns(owner_id,created_at desc);
create index if not exists ifund_campaigns_public_created_idx on public.ifund_campaigns(created_at desc) where status = 'active';
alter table public.ifund_campaigns enable row level security;
revoke all on public.ifund_campaigns from anon, authenticated;
grant select on public.ifund_campaigns to anon;
grant select, insert, update, delete on public.ifund_campaigns to authenticated;
create policy "campaign_public_or_owner_read" on public.ifund_campaigns for select to anon, authenticated
using (status = 'active' or (select auth.uid()) = owner_id);
create policy "campaign_owner_insert" on public.ifund_campaigns for insert to authenticated
with check ((select auth.uid()) = owner_id);
create policy "campaign_owner_update" on public.ifund_campaigns for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);
create policy "campaign_owner_delete" on public.ifund_campaigns for delete to authenticated
using ((select auth.uid()) = owner_id);

create table if not exists public.ifund_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists ifund_posts_created_idx on public.ifund_posts(created_at desc);
alter table public.ifund_posts enable row level security;
revoke all on public.ifund_posts from anon, authenticated;
grant select on public.ifund_posts to anon, authenticated;
grant insert, delete on public.ifund_posts to authenticated;
create policy "posts_read" on public.ifund_posts for select to anon, authenticated using (true);
create policy "posts_author_insert" on public.ifund_posts for insert to authenticated
with check ((select auth.uid()) = author_id);
create policy "posts_author_delete" on public.ifund_posts for delete to authenticated
using ((select auth.uid()) = author_id);

-- Before applying: confirm no existing public table conflicts, review publishing
-- validation against src/lib/validation.js, review auth anonymous-user behavior,
-- test owner/other-user/anon RLS and draft->publish->reload end-to-end in staging.
