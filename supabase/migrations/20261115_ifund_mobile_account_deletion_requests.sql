-- Self-service account deletion initiation for standalone IFund iOS/Android.
-- Never deletes financial records, authorizations, or user identities in this
-- migration. Completion requires separately verified, auditable erasure.
-- All mobile / website requests use the canonical production Supabase service.
create table if not exists public.ifund_account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'requested',
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint ifund_deletion_request_status_check check
    (status in ('requested','reviewing','requires_legal_retention','completed')),
  constraint ifund_deletion_request_completed_check check
    ((status = 'completed') = (completed_at is not null))
);
create unique index if not exists ifund_account_deletion_one_active_per_user
  on public.ifund_account_deletion_requests (user_id)
  where user_id is not null and status <> 'completed';
create index if not exists ifund_account_deletion_status_queue
  on public.ifund_account_deletion_requests (status,requested_at,id);
alter table public.ifund_account_deletion_requests enable row level security;
revoke all on public.ifund_account_deletion_requests from public,anon,authenticated;
grant select on public.ifund_account_deletion_requests to authenticated;
do $p$
begin
 if not exists(select 1 from pg_policies where schemaname='public'
   and tablename='ifund_account_deletion_requests'
   and policyname='ifund_account_deletion_owner_read') then
  create policy ifund_account_deletion_owner_read
   on public.ifund_account_deletion_requests for select to authenticated
   using (user_id = (select auth.uid()));
 end if;
end
$p$;

create or replace function public.ifund_request_account_deletion()
returns table(request_id uuid, request_status text, submitted_at timestamptz)
language plpgsql security definer set search_path to ''
as $fn$
declare
  v_user uuid := auth.uid();
  v_row record;
begin
  if v_user is null or not exists(
    select 1 from auth.users u where u.id=v_user
      and u.is_anonymous is false and u.email_confirmed_at is not null
  ) then
    raise exception 'Confirmed account sign-in required for deletion'
      using errcode='42501';
  end if;
  -- A request MUST be accepted even if an account is otherwise suspended or
  -- inactive; privacy rights do not depend on active subscription status.
  perform pg_catalog.pg_advisory_xact_lock(29913, pg_catalog.hashtext(v_user::text));
  select r.id,r.status,r.requested_at
    into v_row from public.ifund_account_deletion_requests r
    where r.user_id=v_user and r.status <> 'completed'
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

create or replace function public.ifund_my_account_deletion_requests()
returns table(request_id uuid, request_status text, submitted_at timestamptz, updated_at timestamptz)
language sql security invoker set search_path to ''
as $fn$
  select r.id,r.status,r.requested_at,r.updated_at
  from public.ifund_account_deletion_requests r
  where r.user_id=auth.uid()
  order by r.requested_at desc limit 20;
$fn$;
revoke all on function public.ifund_my_account_deletion_requests() from public,anon;
grant execute on function public.ifund_my_account_deletion_requests() to authenticated;

create or replace function public.ifund_super_admin_account_deletion_queue(p_limit integer default 100)
returns table(request_id uuid, requested_user_id uuid, request_status text,
  submitted_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path to ''
as $fn$
begin
 if not coalesce(public.ifund_current_user_is_verified_super_admin(),false) then
   raise exception 'Verified super administrator required' using errcode='42501';
 end if;
 return query
   select r.id,r.user_id,r.status,r.requested_at,r.updated_at
   from public.ifund_account_deletion_requests r
   where r.status <> 'completed'
   order by r.requested_at asc,r.id asc
   limit least(200,greatest(1,coalesce(p_limit,100)));
end
$fn$;
revoke all on function public.ifund_super_admin_account_deletion_queue(integer) from public,anon;
grant execute on function public.ifund_super_admin_account_deletion_queue(integer) to authenticated;

comment on table public.ifund_account_deletion_requests is
 'Self-service IFund permanent account deletion queue; actual erasure and legal retention require separately verified privileged workflow.';
