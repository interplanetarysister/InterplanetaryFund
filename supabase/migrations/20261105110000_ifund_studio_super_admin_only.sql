-- Restrict all Studio data and AI quota to the sole verified super-admin.
-- The original Studio migration allowed ordinary verified administrators.
create or replace function public.ifund_is_studio_admin()
returns boolean language sql stable security invoker set search_path = ''
as $$
  select coalesce(public.ifund_current_user_is_verified_super_admin(), false);
$$;
revoke all on function public.ifund_is_studio_admin() from public, anon;
grant execute on function public.ifund_is_studio_admin() to authenticated;
