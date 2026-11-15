-- Canonical IFund signed-in creator blocking for Apple UGC guideline 1.2.
-- Additive, independent of Base44 and the financial ledger. No anonymous
-- access, no user-ID disclosure via public campaign queries.
create table if not exists public.ifund_mobile_organizer_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  organizer_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint ifund_mobile_organizer_blocks_pk primary key (blocker_id,organizer_id),
  constraint ifund_mobile_organizer_blocks_no_self check (blocker_id <> organizer_id)
);
alter table public.ifund_mobile_organizer_blocks enable row level security;
revoke all on public.ifund_mobile_organizer_blocks from public, anon, authenticated;
grant select on public.ifund_mobile_organizer_blocks to authenticated;
do $do$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public'
      and tablename='ifund_mobile_organizer_blocks'
      and policyname='ifund_mobile_blocks_owner_read'
  ) then
    create policy ifund_mobile_blocks_owner_read
      on public.ifund_mobile_organizer_blocks
      for select to authenticated
      using (blocker_id = (select auth.uid()));
  end if;
end
$do$;

create or replace function public.ifund_mobile_block_organizer(p_organizer uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or p_organizer is null or v_user = p_organizer then
    raise exception 'Verified distinct organizer required' using errcode='42501';
  end if;
  if not exists (
    select 1 from auth.users u
    where u.id=v_user and u.is_anonymous is false and u.email_confirmed_at is not null
  ) or not coalesce(public.ifund_current_account_is_active(),false) then
    raise exception 'Confirmed active account required' using errcode='42501';
  end if;
  -- An arbitrary ID cannot be used to enumerate accounts. Only a real account
  -- which has an active public campaign can be blocked through this service.
  if not exists (
    select 1 from public.ifund_campaigns c
    where c.owner_id=p_organizer and c.status='active'
  ) then
    raise exception 'Published campaign organizer unavailable' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(29489,pg_catalog.hashtext(v_user::text));
  if not exists (
    select 1 from public.ifund_mobile_organizer_blocks b
    where b.blocker_id=v_user and b.organizer_id=p_organizer
  ) and (
    select count(*) from public.ifund_mobile_organizer_blocks b
    where b.blocker_id=v_user
  ) >= 250 then
    raise exception 'Maximum blocked organizers reached' using errcode='22023';
  end if;
  insert into public.ifund_mobile_organizer_blocks (blocker_id,organizer_id)
  values (v_user,p_organizer)
  on conflict (blocker_id,organizer_id) do nothing;
  return true;
end
$fn$;
revoke all on function public.ifund_mobile_block_organizer(uuid) from public, anon;
grant execute on function public.ifund_mobile_block_organizer(uuid) to authenticated;

create or replace function public.ifund_mobile_unblock_organizer(p_organizer uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $fn$
declare v_user uuid := auth.uid();
begin
  if v_user is null or p_organizer is null then
    raise exception 'Sign in required' using errcode='42501';
  end if;
  if not exists (
    select 1 from auth.users u
    where u.id=v_user and u.is_anonymous is false and u.email_confirmed_at is not null
  ) then
    raise exception 'Confirmed account required' using errcode='42501';
  end if;
  delete from public.ifund_mobile_organizer_blocks b
    where b.blocker_id=v_user and b.organizer_id=p_organizer;
  return true;
end
$fn$;
revoke all on function public.ifund_mobile_unblock_organizer(uuid) from public, anon;
grant execute on function public.ifund_mobile_unblock_organizer(uuid) to authenticated;

comment on table public.ifund_mobile_organizer_blocks is
  'Signed-in member-only creator blocking for IFund mobile content; no public reads.';
