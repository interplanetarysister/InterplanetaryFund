-- IFund Studio foundation. Review and test in staging before applying anywhere.
create or replace function public.ifund_is_studio_admin()
returns boolean language sql stable security invoker set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'super_admin'), false);
$$;
revoke all on function public.ifund_is_studio_admin() from public, anon;
grant execute on function public.ifund_is_studio_admin() to authenticated;

create table if not exists public.ifund_studio_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content jsonb not null default '{"blocks":[]}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint ifund_studio_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and length(slug) between 3 and 60),
  constraint ifund_studio_title_length check (length(trim(title)) between 1 and 120),
  constraint ifund_studio_content_object check (jsonb_typeof(content) = 'object'),
  constraint ifund_studio_publish_timestamp check (
    (status = 'published' and published_at is not null) or (status = 'draft' and published_at is null)
  )
);
create index if not exists ifund_studio_pages_status_updated on public.ifund_studio_pages(status, updated_at desc);
alter table public.ifund_studio_pages enable row level security;
revoke all privileges on table public.ifund_studio_pages from public, anon, authenticated;
grant select on public.ifund_studio_pages to anon, authenticated;
grant insert, update, delete on public.ifund_studio_pages to authenticated;
drop policy if exists ifund_studio_admin_all on public.ifund_studio_pages;
create policy ifund_studio_admin_all on public.ifund_studio_pages for all to authenticated
  using (public.ifund_is_studio_admin()) with check (public.ifund_is_studio_admin());
-- Visitors may read published page documents only; drafts remain administrator-only.
drop policy if exists ifund_studio_published_read on public.ifund_studio_pages;
create policy ifund_studio_published_read on public.ifund_studio_pages
  for select to anon, authenticated using (status = 'published');

create or replace function public.ifund_studio_touch_updated_at()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status = 'published' and old.status is distinct from 'published' then
    new.published_at := now();
  elsif new.status = 'draft' then
    new.published_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists ifund_studio_pages_touch_updated_at on public.ifund_studio_pages;
create trigger ifund_studio_pages_touch_updated_at before update on public.ifund_studio_pages
  for each row execute function public.ifund_studio_touch_updated_at();
-- Migration artifact only: this file has not been applied to the connected project.
