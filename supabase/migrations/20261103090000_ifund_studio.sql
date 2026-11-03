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

-- Very small global AI budget: at most two layout generations per UTC day.
-- The counter is private and can only be consumed through the trusted RPC.
create table if not exists public.ifund_studio_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  request_count integer not null default 0 check (request_count between 0 and 2),
  primary key (user_id, usage_date)
);
alter table public.ifund_studio_ai_usage enable row level security;
revoke all privileges on table public.ifund_studio_ai_usage from public, anon, authenticated;

create or replace function public.ifund_studio_consume_ai_quota()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_total integer := 0;
  v_user_count integer := 0;
begin
  if v_user is null or not public.ifund_is_studio_admin() then
    return false;
  end if;
  perform pg_advisory_xact_lock(81472619::bigint);
  select coalesce(sum(request_count), 0)::integer
    into v_total
    from public.ifund_studio_ai_usage
    where usage_date = current_date;
  select coalesce(request_count, 0)::integer
    into v_user_count
    from public.ifund_studio_ai_usage
    where user_id = v_user and usage_date = current_date;
  if v_total >= 2 or v_user_count >= 2 then
    return false;
  end if;
  insert into public.ifund_studio_ai_usage(user_id, usage_date, request_count)
    values (v_user, current_date, 1)
    on conflict (user_id, usage_date)
    do update set request_count = public.ifund_studio_ai_usage.request_count + 1;
  return true;
end;
$$;
revoke all on function public.ifund_studio_consume_ai_quota() from public, anon;
grant execute on function public.ifund_studio_consume_ai_quota() to authenticated;
