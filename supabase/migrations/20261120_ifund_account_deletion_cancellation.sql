-- Retain request audit after an eligible owner withdraws an unprocessed deletion.
-- No accounts, profiles, payments, or files are modified by this migration.
-- A disabled account or an account whose private-file cleanup began cannot
-- self-reactivate just by cancelling the request.
alter table public.ifund_account_deletion_requests
  add column if not exists erasure_started_at timestamptz,
  add column if not exists cancelled_at timestamptz;

alter table public.ifund_account_deletion_requests
  drop constraint if exists ifund_deletion_request_status_check;
alter table public.ifund_account_deletion_requests
  add constraint ifund_deletion_request_status_check
  check (status in ('requested','reviewing','requires_legal_retention','completed','cancelled'));

alter table public.ifund_account_deletion_requests
  drop constraint if exists ifund_deletion_cancelled_consistency;
alter table public.ifund_account_deletion_requests
  add constraint ifund_deletion_cancelled_consistency
  check ((status='cancelled')=(cancelled_at is not null));

-- Cancelled requests remain historical records, never live queue entries.
drop index if exists public.ifund_account_deletion_one_active_per_user;
create unique index ifund_account_deletion_one_active_per_user
  on public.ifund_account_deletion_requests(user_id)
  where user_id is not null
    and status in ('requested','reviewing','requires_legal_retention');

-- Maintain the original return shape to avoid changing existing clients.
create or replace function public.ifund_request_account_deletion()
returns table(request_id uuid,request_status text,submitted_at timestamptz)
language plpgsql security definer set search_path=''
as $fn$
declare
 v_user uuid:=auth.uid();
 v_row record;
begin
 if v_user is null or not exists(
   select 1 from auth.users u where u.id=v_user
   and (u.is_anonymous is true or u.email_confirmed_at is not null)
 ) then raise exception 'Authenticated account session required for deletion' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(29913,pg_catalog.hashtext(v_user::text));
 select r.id,r.status,r.requested_at into v_row
 from public.ifund_account_deletion_requests r
 where r.user_id=v_user and r.status in ('requested','reviewing','requires_legal_retention')
 order by r.requested_at desc limit 1;
 if not found then
   insert into public.ifund_account_deletion_requests(user_id)
   values(v_user) returning id,status,requested_at into v_row;
 end if;
 return query select v_row.id::uuid,v_row.status::text,v_row.requested_at::timestamptz;
end $fn$;
revoke all on function public.ifund_request_account_deletion() from public,anon;
grant execute on function public.ifund_request_account_deletion() to authenticated;

-- Request owner can cancel a pending request ONLY if no closure or file
-- erasure process has begun. The auth identity must still be provider-verified.
-- Never grant users direct UPDATE rights on the queue table.
create or replace function public.ifund_cancel_account_deletion(p_request_id uuid)
returns table(request_id uuid,request_status text,updated_at timestamptz)
language plpgsql security definer set search_path=''
as $fn$
declare v_user uuid:=auth.uid();
declare v_row record;
begin
 if v_user is null or not exists(
   select 1 from auth.users u where u.id=v_user
   and (u.is_anonymous is true or u.email_confirmed_at is not null)
 ) then raise exception 'Authenticated account session required' using errcode='42501'; end if;
 if p_request_id is null then raise exception 'Request reference required' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(29913,pg_catalog.hashtext(v_user::text));
 select r.id,r.status,r.account_disabled_at,r.erasure_started_at,
        r.document_cleanup_reviewed_at,r.completed_at
 into v_row
 from public.ifund_account_deletion_requests r
 where r.id=p_request_id and r.user_id=v_user
 for update;
 if not found then raise exception 'Active deletion request not found for account' using errcode='P0002'; end if;
 if v_row.status not in ('requested','reviewing','requires_legal_retention')
   or v_row.account_disabled_at is not null
   or v_row.erasure_started_at is not null
   or v_row.document_cleanup_reviewed_at is not null
   or v_row.completed_at is not null
 then raise exception 'Deletion has entered protected review; contact support for verified recovery'
   using errcode='42501'; end if;
 return query
   update public.ifund_account_deletion_requests r
   set status='cancelled',cancelled_at=now(),updated_at=now()
   where r.id=p_request_id and r.user_id=v_user
   returning r.id,r.status,r.updated_at;
end $fn$;
revoke all on function public.ifund_cancel_account_deletion(uuid) from public,anon,authenticated;
grant execute on function public.ifund_cancel_account_deletion(uuid) to authenticated;

create or replace function public.ifund_super_admin_account_deletion_queue(p_limit integer default 100)
returns table(request_id uuid,requested_user_id uuid,request_status text,
 submitted_at timestamptz,updated_at timestamptz)
language plpgsql security definer set search_path=''
as $fn$
begin
 if auth.uid() is null or not coalesce(public.ifund_current_user_is_verified_super_admin(),false)
 then raise exception 'Verified super administrator required' using errcode='42501'; end if;
 return query
 select r.id,r.user_id,r.status,r.requested_at,r.updated_at
 from public.ifund_account_deletion_requests r
 where r.status in ('requested','reviewing','requires_legal_retention')
 order by r.requested_at asc,r.id asc
 limit least(200,greatest(1,coalesce(p_limit,100)));
end $fn$;
revoke all on function public.ifund_super_admin_account_deletion_queue(integer) from public,anon;
grant execute on function public.ifund_super_admin_account_deletion_queue(integer) to authenticated;

comment on function public.ifund_cancel_account_deletion(uuid) is
 'Owner-only cancellation of not-yet-disabled, not-yet-erasing deletion requests. Audited status change, no account deletion or reactivation.';
