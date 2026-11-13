-- New independent community memberships for interplanetaryfund.com.
-- Legacy Base44 ifund_community tables remain untouched until identity reconciliation.
create table if not exists public.ifund_member_communities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 3 and 90),
  description text not null check (char_length(btrim(description)) between 15 and 2000),
  location text not null default '' check (char_length(location) <= 120),
  status text not null default 'published' check (status in ('published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ifund_member_communities_public_idx
  on public.ifund_member_communities (created_at desc, id) where status='published';
create index if not exists ifund_member_communities_owner_idx
  on public.ifund_member_communities(owner_id,created_at desc);
create table if not exists public.ifund_member_community_memberships (
  community_id uuid not null references public.ifund_member_communities(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (community_id,member_id)
);
create index if not exists ifund_member_community_members_idx
 on public.ifund_member_community_memberships(member_id,joined_at desc);
alter table public.ifund_member_communities enable row level security;
alter table public.ifund_member_community_memberships enable row level security;
revoke all on public.ifund_member_communities from anon,authenticated;
revoke all on public.ifund_member_community_memberships from anon,authenticated;
grant select on public.ifund_member_communities to anon,authenticated;
grant insert (owner_id,name,description,location) on public.ifund_member_communities to authenticated;
grant update (name,description,location,status) on public.ifund_member_communities to authenticated;
grant select on public.ifund_member_community_memberships to authenticated;
grant insert (community_id,member_id) on public.ifund_member_community_memberships to authenticated;
grant delete on public.ifund_member_community_memberships to authenticated;

create or replace function public.ifund_eligible_community_member(p_user uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select p_user = auth.uid()
    and exists (select 1 from public.ifund_profiles p
                where p.id=p_user and p.account_status='active'
                  and p.account_deletion_pending=false)
    and exists (select 1 from public.ifund_legal_acceptances l
                where l.owner_id=p_user and l.explicit_consent=true
                  and l.terms_version='2026-11-10-v4')
$$;
revoke all on function public.ifund_eligible_community_member(uuid) from public;
grant execute on function public.ifund_eligible_community_member(uuid) to authenticated;

drop policy if exists ifund_community_public_view on public.ifund_member_communities;
create policy ifund_community_public_view on public.ifund_member_communities
for select to anon,authenticated using (status='published' or owner_id=auth.uid());
drop policy if exists ifund_community_owner_create on public.ifund_member_communities;
create policy ifund_community_owner_create on public.ifund_member_communities
for insert to authenticated
with check(owner_id=auth.uid() and public.ifund_eligible_community_member(auth.uid()));
drop policy if exists ifund_community_owner_update on public.ifund_member_communities;
create policy ifund_community_owner_update on public.ifund_member_communities
for update to authenticated using(owner_id=auth.uid() and public.ifund_eligible_community_member(auth.uid()))
with check(owner_id=auth.uid() and public.ifund_eligible_community_member(auth.uid()));
drop policy if exists ifund_community_member_self_read on public.ifund_member_community_memberships;
create policy ifund_community_member_self_read on public.ifund_member_community_memberships
for select to authenticated using(member_id=auth.uid());
drop policy if exists ifund_community_member_self_join on public.ifund_member_community_memberships;
create policy ifund_community_member_self_join on public.ifund_member_community_memberships
for insert to authenticated with check (
 member_id=auth.uid()
 and public.ifund_eligible_community_member(auth.uid())
 and exists(select 1 from public.ifund_member_communities c
            where c.id=community_id and c.status='published'));
drop policy if exists ifund_community_member_self_leave on public.ifund_member_community_memberships;
create policy ifund_community_member_self_leave on public.ifund_member_community_memberships
for delete to authenticated using(member_id=auth.uid());
