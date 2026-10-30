-- STAGED ONLY, pending owner authorization and cross-user RLS verification.
-- Original entities: UserBlog, BlogEntry, OfficialPublication.
-- Historical IDs and authors must be mapped before importing any content.
begin;

create table public.ifund_user_blogs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  type text not null default 'member' check (type in ('member','official')),
  title text not null check (char_length(title) between 3 and 90),
  description text check (char_length(description)<=500),
  cover_image_url text check (char_length(cover_image_url)<=2048),
  author_display_name text check (char_length(author_display_name)<=120),
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index ifund_one_member_blog_per_owner
  on public.ifund_user_blogs(owner_id) where type='member';
create index ifund_user_blogs_owner_idx on public.ifund_user_blogs(owner_id);

create table public.ifund_blog_entries (
  id uuid primary key default gen_random_uuid(),
  blog_id uuid not null references public.ifund_user_blogs(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete restrict,
  type text not null default 'article' check (type in ('article','newsletter')),
  title text not null check (char_length(title) between 3 and 140),
  summary text not null default '' check (char_length(summary)<=400),
  body text not null check (char_length(body) between 1 and 18000),
  status text not null default 'draft' check (status in ('draft','published')),
  featured boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ifund_blog_published_date check (
    status <> 'published' or published_at is not null
  )
);
create index ifund_blog_entries_published_idx
  on public.ifund_blog_entries(published_at desc,id desc)
  where status='published';
create index ifund_blog_entries_owner_idx
  on public.ifund_blog_entries(owner_id,created_at desc);

create table public.ifund_official_publications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('report','status_report','presentation','research','announcement')),
  title text not null check (char_length(title) between 5 and 140),
  summary text not null check (char_length(summary) between 20 and 500),
  body text not null default '' check (char_length(body)<=24000),
  pdf_url text check (
    pdf_url is null or
    (char_length(pdf_url)<=2000 and pdf_url like 'https://%')
  ),
  file_label text check (char_length(file_label)<=140),
  status text not null default 'unpublished'
    check (status in ('published','unpublished')),
  final_approved boolean not null default false,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint ifund_publication_final_public check (
    status <> 'published' or (final_approved=true and published_at is not null)
  )
);
create index ifund_publications_public_idx
  on public.ifund_official_publications(published_at desc,id desc)
  where status='published' and final_approved=true;

alter table public.ifund_user_blogs enable row level security;
alter table public.ifund_blog_entries enable row level security;
alter table public.ifund_official_publications enable row level security;
revoke all on public.ifund_user_blogs,public.ifund_blog_entries,
  public.ifund_official_publications from public,anon,authenticated;
grant select on public.ifund_user_blogs,public.ifund_blog_entries,
  public.ifund_official_publications to anon,authenticated;

create policy ifund_blogs_public on public.ifund_user_blogs
  for select to anon,authenticated
  using (status='active' or owner_id=(select auth.uid()));
create policy ifund_entries_published_or_owner on public.ifund_blog_entries
  for select to anon,authenticated
  using (status='published' or owner_id=(select auth.uid()));
create policy ifund_publications_final on public.ifund_official_publications
  for select to anon,authenticated
  using (status='published' and final_approved=true);

-- No browser INSERT/UPDATE/DELETE until the real member subscription
-- entitlement, original creator ownership, admin approvals, and
-- canonical publication audit services have been ported and verified.
commit;
