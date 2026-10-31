-- Reporter publication migration. Additive only; source Base44 records remain untouched.
create table public.ifund_blogs (
  id text primary key,
  owner_auth_user_id uuid not null references auth.users(id) on delete restrict,
  legacy_owner_user_id text not null,
  type text not null,
  title text not null,
  description text,
  slug text,
  cover_image_url text,
  status text not null check (status in ('active','archived')),
  created_at timestamptz,
  updated_at timestamptz,
  legacy_created_date timestamptz,
  legacy_updated_date timestamptz,
  source_system text not null default 'base44',
  migrated_at timestamptz not null default now()
);
create table public.ifund_blog_entries (
  id text primary key,
  blog_id text not null references public.ifund_blogs(id) on delete restrict,
  owner_auth_user_id uuid not null references auth.users(id) on delete restrict,
  legacy_owner_user_id text not null,
  legacy_created_by_id text,
  type text not null check (type in ('article','newsletter')),
  title text not null,
  summary text,
  body text not null default '',
  status text not null check (status in ('draft','published')),
  featured boolean not null default false,
  published_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  legacy_created_date timestamptz,
  legacy_updated_date timestamptz,
  source_system text not null default 'base44',
  migrated_at timestamptz not null default now()
);
create index if not exists ifund_blog_entries_public_recent on public.ifund_blog_entries (published_at desc) where status = 'published';
create index if not exists ifund_blog_entries_owner_recent on public.ifund_blog_entries (owner_auth_user_id, updated_at desc);
alter table public.ifund_blogs enable row level security;
alter table public.ifund_blog_entries enable row level security;
revoke all on public.ifund_blogs, public.ifund_blog_entries from public, anon, authenticated;
grant select on public.ifund_blogs to anon, authenticated;
grant insert, update, delete on public.ifund_blogs to authenticated;
grant select on public.ifund_blog_entries to anon, authenticated;
grant insert, update, delete on public.ifund_blog_entries to authenticated;
create policy ifund_blogs_read_active on public.ifund_blogs for select to anon, authenticated using (status = 'active');
create policy ifund_blogs_owner_manage on public.ifund_blogs for all to authenticated using (owner_auth_user_id = (select auth.uid())) with check (owner_auth_user_id = (select auth.uid()));
create policy ifund_blog_entries_read_public_or_owner on public.ifund_blog_entries for select to anon, authenticated using (status = 'published' or owner_auth_user_id = (select auth.uid()));
create policy ifund_blog_entries_owner_insert on public.ifund_blog_entries for insert to authenticated with check (owner_auth_user_id = (select auth.uid()));
create policy ifund_blog_entries_owner_update on public.ifund_blog_entries for update to authenticated using (owner_auth_user_id = (select auth.uid())) with check (owner_auth_user_id = (select auth.uid()));
create policy ifund_blog_entries_owner_delete on public.ifund_blog_entries for delete to authenticated using (owner_auth_user_id = (select auth.uid()));
comment on table public.ifund_blogs is 'Migrated Base44 IFund blog metadata. Original IDs and owner identity retained; authenticated ownership is explicitly mapped.';
comment on table public.ifund_blog_entries is 'Migrated Base44 blog articles and newsletters. Original IDs, author IDs, statuses, and timestamps are retained.';
