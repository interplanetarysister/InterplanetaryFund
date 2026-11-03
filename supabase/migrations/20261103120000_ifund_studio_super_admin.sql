-- Restrict Website Studio to the verified IFund super-administrator.
create or replace function public.ifund_current_user_is_verified_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.ifund_current_user_is_verified_admin(), false)
     and coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin', false);
$$;

revoke all on function public.ifund_current_user_is_verified_super_admin() from public, anon;
grant execute on function public.ifund_current_user_is_verified_super_admin() to authenticated;

create or replace function public.ifund_studio_is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select public.ifund_current_user_is_verified_super_admin();
$$;

revoke all on function public.ifund_studio_is_admin() from public, anon;
grant execute on function public.ifund_studio_is_admin() to authenticated;
