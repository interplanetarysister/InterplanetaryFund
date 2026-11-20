begin;
-- Low-risk inbound sponsor interest only: no offer posting, payout, live approval
-- or contract implied by an application. Kept separate from verified sponsors.
create table if not exists public.ifund_sponsor_inquiries (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete restrict,
 organization_name text not null check(length(trim(organization_name)) between 2 and 160),
 website text not null check(website ~ '^https://[^[:space:]]+$'),
 proposal text not null check(length(trim(proposal)) between 30 and 3000),
 state text not null default 'submitted' check(state in ('submitted','reviewing','contacted','closed')),
 public_status_message text not null default '' check(length(public_status_message)<=500),
 submitted_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id) on delete set null,
 constraint ifund_sponsor_inquiry_reviewed_states check(
    state='submitted' or reviewed_at is not null
 )
);
create unique index if not exists ifund_sponsor_inquiries_owner_company
 on public.ifund_sponsor_inquiries(owner_id,lower(organization_name));
create index if not exists ifund_sponsor_inquiries_state
 on public.ifund_sponsor_inquiries(state,submitted_at);
alter table public.ifund_sponsor_inquiries enable row level security;
create policy ifund_sponsor_inquiry_owner_read on public.ifund_sponsor_inquiries
 for select to authenticated using(owner_id=(select auth.uid()));
create policy ifund_sponsor_inquiry_admin_read on public.ifund_sponsor_inquiries
 for select to authenticated using((select public.ifund_current_user_is_verified_super_admin()));
create policy ifund_sponsor_inquiry_owner_submit on public.ifund_sponsor_inquiries
 for insert to authenticated with check (
   owner_id=(select auth.uid()) and state='submitted' and reviewed_at is null
   and reviewed_by is null and public_status_message=''
   and (select public.ifund_current_account_is_active())=true
   and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
 );
create policy ifund_sponsor_inquiry_admin_review on public.ifund_sponsor_inquiries
 for update to authenticated
 using((select public.ifund_current_user_is_verified_super_admin()))
 with check((select public.ifund_current_user_is_verified_super_admin()));

create or replace function public.ifund_sponsor_inquiry_review_stamp()
returns trigger language plpgsql security invoker
set search_path=public,pg_temp as $fn$
begin
 if not public.ifund_current_user_is_verified_super_admin() then
  raise exception 'Sponsor inquiry review requires verified super admin';
 end if;
 if new.owner_id is distinct from old.owner_id or
    new.organization_name is distinct from old.organization_name or
    new.website is distinct from old.website or
    new.proposal is distinct from old.proposal or
    new.submitted_at is distinct from old.submitted_at then
  raise exception 'Sponsor inquiry identity and submission are immutable';
 end if;
 new.reviewed_at=now();
 new.reviewed_by=auth.uid();
 return new;
end;
$fn$;
revoke all on function public.ifund_sponsor_inquiry_review_stamp() from public,anon,authenticated;
create trigger ifund_sponsor_inquiry_review_stamp
 before update on public.ifund_sponsor_inquiries
 for each row execute function public.ifund_sponsor_inquiry_review_stamp();
revoke all on public.ifund_sponsor_inquiries from public,anon,authenticated;
grant select (id,owner_id,organization_name,website,proposal,state,public_status_message,submitted_at,reviewed_at,reviewed_by)
 on public.ifund_sponsor_inquiries to authenticated;
grant insert (owner_id,organization_name,website,proposal) on public.ifund_sponsor_inquiries to authenticated;
grant update (state,public_status_message) on public.ifund_sponsor_inquiries to authenticated;
commit;
