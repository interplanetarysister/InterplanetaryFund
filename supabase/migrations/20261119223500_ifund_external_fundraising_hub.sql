-- Member-owned, cross-platform fundraising tracker. This is a reporting hub,
-- NOT a payment ledger, host partnership claim, or permission to scrape hosts.
create table if not exists public.ifund_external_fundraiser_groups (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 3 and 160),
 created_at timestamptz not null default now(),
 unique (id, owner_id)
);
create table if not exists public.ifund_external_fundraiser_sources (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 group_id uuid not null,
 platform text not null check (platform in ('gofundme','givebutter','fundrazr')),
 campaign_url text not null,
 amount_cents bigint check (amount_cents is null or amount_cents between 0 and 1000000000000),
 currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
 provenance text not null default 'owner_reported' check (provenance = 'owner_reported'),
 reported_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint ifund_external_source_group_fk foreign key (group_id,owner_id)
   references public.ifund_external_fundraiser_groups(id,owner_id) on delete cascade,
 constraint ifund_external_source_url_valid check (
   char_length(campaign_url) between 20 and 2048 and
   campaign_url !~ '[[:space:]]' and
   campaign_url !~* '^https://(www\.)?(givebutter|fundrazr)\.com/(account|login|checkout|settings|admin|donate)(/|$)' and
   (
    (platform='gofundme' and campaign_url ~* '^https://(www\.)?gofundme\.com/f/[a-z0-9_-]+/?$') or
    (platform='givebutter' and campaign_url ~* '^https://(www\.)?givebutter\.com/(c/)?[a-z0-9_-]+(/[a-z0-9_-]+)?/?$') or
    (platform='fundrazr' and campaign_url ~* '^https://(www\.)?fundrazr\.com/(campaigns/[a-z0-9_-]+(/ab/[a-z0-9_-]+)?|[a-z0-9_-]+)/?$')
   )
 ),
 unique (owner_id, campaign_url)
);
create index if not exists ifund_external_fundraiser_group_owner_idx
 on public.ifund_external_fundraiser_groups(owner_id,created_at desc);
create index if not exists ifund_external_fundraiser_source_owner_idx
 on public.ifund_external_fundraiser_sources(owner_id,group_id);
alter table public.ifund_external_fundraiser_groups enable row level security;
alter table public.ifund_external_fundraiser_sources enable row level security;
revoke all on public.ifund_external_fundraiser_groups from anon,authenticated;
revoke all on public.ifund_external_fundraiser_sources from anon,authenticated;
grant select,insert,update,delete on public.ifund_external_fundraiser_groups to authenticated;
grant select,insert,update,delete on public.ifund_external_fundraiser_sources to authenticated;
-- Owner must have an active account. Access does not follow shared links.
create policy ifund_external_groups_owner_select on public.ifund_external_fundraiser_groups for select to authenticated
 using (owner_id=auth.uid() and exists (select 1 from public.ifund_profiles p where p.id=auth.uid() and p.account_status='active' and p.account_deletion_pending=false));
create policy ifund_external_groups_owner_insert on public.ifund_external_fundraiser_groups for insert to authenticated
 with check (owner_id=auth.uid() and exists (select 1 from public.ifund_profiles p where p.id=auth.uid() and p.account_status='active' and p.account_deletion_pending=false));
create policy ifund_external_groups_owner_update on public.ifund_external_fundraiser_groups for update to authenticated
 using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy ifund_external_groups_owner_delete on public.ifund_external_fundraiser_groups for delete to authenticated
 using (owner_id=auth.uid());
create policy ifund_external_sources_owner_select on public.ifund_external_fundraiser_sources for select to authenticated
 using (owner_id=auth.uid() and exists (select 1 from public.ifund_profiles p where p.id=auth.uid() and p.account_status='active' and p.account_deletion_pending=false));
create policy ifund_external_sources_owner_insert on public.ifund_external_fundraiser_sources for insert to authenticated
 with check (owner_id=auth.uid() and exists (select 1 from public.ifund_profiles p where p.id=auth.uid() and p.account_status='active' and p.account_deletion_pending=false));
create policy ifund_external_sources_owner_update on public.ifund_external_fundraiser_sources for update to authenticated
 using (owner_id=auth.uid()) with check (owner_id=auth.uid() and provenance='owner_reported');
create policy ifund_external_sources_owner_delete on public.ifund_external_fundraiser_sources for delete to authenticated
 using (owner_id=auth.uid());
comment on table public.ifund_external_fundraiser_sources is 'Member-reported cumulative totals by external hosting platform. Never first-party donation ledger, payment confirmation, or authorization to scrape.';
