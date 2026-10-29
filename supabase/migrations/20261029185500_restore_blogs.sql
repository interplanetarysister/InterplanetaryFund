-- Source-only proposal: do not apply until the IFund migration release is authorized.
-- Creator/editor access comes from trusted membership decisions, never user_metadata.
create table if not exists public.ifund_creator_access (
  member_id uuid primary key references auth.users(id) on delete cascade,
  can_publish boolean not null default false,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.ifund_creator_access enable row level security;
create policy ifund_creator_access_own_read on public.ifund_creator_access
  for select to authenticated using (member_id = (select auth.uid()));
grant select on public.ifund_creator_access to authenticated;
-- No client INSERT or UPDATE rights to access grants. Admin/service grant separately.

create table if not exists public.ifund_blogs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 140),
  description text not null default '' check (char_length(description) <= 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ifund_blogs enable row level security;
create policy ifund_blogs_owner_read on public.ifund_blogs
  for select to authenticated using (owner_id = (select auth.uid()));
create policy ifund_blogs_owner_insert on public.ifund_blogs
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy ifund_blogs_owner_update on public.ifund_blogs
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
grant select, insert, update on public.ifund_blogs to authenticated;

create table if not exists public.ifund_blog_entries (
  id uuid primary key default gen_random_uuid(),
  blog_id uuid not null references public.ifund_blogs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 160),
  summary text not null default '' check (char_length(summary) <= 500),
  body text not null default '' check (char_length(body) <= 30000),
  kind text not null default 'blog' check (kind in ('blog','newsletter')),
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint ifund_blog_entry_complete check (
    status <> 'published' or (char_length(trim(title))>0 and char_length(trim(body))>0)
  ),
  constraint ifund_blog_publish_timestamp check (
    (status='draft') or published_at is not null
  )
);
create index if not exists ifund_blog_feed_order
  on public.ifund_blog_entries(status,published_at desc);
create index if not exists ifund_blog_owner_order
  on public.ifund_blog_entries(owner_id,created_at desc);
alter table public.ifund_blog_entries enable row level security;
create policy ifund_blog_entries_public_read on public.ifund_blog_entries
  for select to anon,authenticated
  using (status = 'published' or owner_id = (select auth.uid()));
-- Drafts are available to authors. Publishing is reserved to verified creators
-- or a server-managed admin claim; browser-side tier changes never grant access.
create policy ifund_blog_entries_owner_insert on public.ifund_blog_entries
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.ifund_blogs b
      where b.id=blog_id and b.owner_id=(select auth.uid()))
    and (status = 'draft' or (
      (select auth.jwt()->'app_metadata'->>'role') in ('admin','super_admin')
      or exists (select 1 from public.ifund_creator_access a
        where a.member_id=(select auth.uid())
        and a.can_publish=true
        and (a.expires_at is null or a.expires_at>now()))
    ))
  );
create policy ifund_blog_entries_owner_update on public.ifund_blog_entries
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.ifund_blogs b
      where b.id=blog_id and b.owner_id=(select auth.uid()))
    and (status = 'draft' or (
      (select auth.jwt()->'app_metadata'->>'role') in ('admin','super_admin')
      or exists (select 1 from public.ifund_creator_access a
        where a.member_id=(select auth.uid())
        and a.can_publish=true
        and (a.expires_at is null or a.expires_at>now()))
    ))
  );
grant select on public.ifund_blog_entries to anon;
grant select,insert,update on public.ifund_blog_entries to authenticated;
-- No client DELETE or access-grant writes. No default auto-generated articles.
