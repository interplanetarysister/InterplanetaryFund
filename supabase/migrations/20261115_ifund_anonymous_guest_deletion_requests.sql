-- Guest-identity account deletion support for Apple App Review 5.1.1(v).
-- A Supabase anonymous session is a real auth.users identity. The caller
-- must prove possession of its JWT through auth.uid(); no public/anon role.
-- This does not create, erase or mutate unrelated users or financial records.
create or replace function public.ifund_request_account_deletion()
returns table(request_id uuid, request_status text, submitted_at timestamptz)
language plpgsql security definer set search_path to ''
as $fn$
declare
  v_user uuid := auth.uid();
  v_row record;
begin
  if v_user is null or not exists (
    select 1 from auth.users u where u.id=v_user
      and (u.is_anonymous is true or u.email_confirmed_at is not null)
  ) then
    raise exception 'Authenticated account session required for deletion'
      using errcode='42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(29913,pg_catalog.hashtext(v_user::text));
  select r.id,r.status,r.requested_at into v_row
    from public.ifund_account_deletion_requests r
    where r.user_id=v_user and r.status<>'completed'
    order by r.requested_at desc limit 1;
  if not found then
    insert into public.ifund_account_deletion_requests(user_id)
      values(v_user)
      returning id,status,requested_at into v_row;
  end if;
  return query select v_row.id::uuid,v_row.status::text,v_row.requested_at::timestamptz;
end
$fn$;
revoke all on function public.ifund_request_account_deletion() from public,anon;
grant execute on function public.ifund_request_account_deletion() to authenticated;

comment on function public.ifund_request_account_deletion() is
  'Idempotent account deletion request for a confirmed member or an authenticated anonymous guest session; no direct erasure.';
