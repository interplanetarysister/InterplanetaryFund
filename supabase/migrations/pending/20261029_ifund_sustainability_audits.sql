-- STAGED ONLY. Original SustainabilityAudit evidence record, admin role
-- checks, and browser-local resource-transfer sampling. Never equate transfer
-- bytes with electricity use, CO2, verified climate benefits, or emissions.
begin;
create table public.ifund_sustainability_audits (
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references auth.users(id) on delete restrict,
 kind text not null check (kind in ('browser_sample','hosting','efficiency','environmental_impact')),
 summary text not null check (char_length(summary) between 1 and 220),
 observed_at timestamptz not null,
 source_url text check (
  source_url is null or
  (left(source_url,8)='https://' and char_length(source_url)<=2000)
 ),
 notes text not null default '' check (char_length(notes)<=2000),
 verification_status text not null default 'unverified'
  check (verification_status in ('unverified','documented','independently_verified')),
 transfer_bytes_observed bigint check (transfer_bytes_observed>=0),
 resource_count_observed integer check (resource_count_observed>=0),
 resources_missing_transfer_data integer check (resources_missing_transfer_data>=0),
 created_at timestamptz not null default now()
);
create index ifund_sustainability_recent_idx
 on public.ifund_sustainability_audits(created_at desc);
alter table public.ifund_sustainability_audits enable row level security;
revoke all on public.ifund_sustainability_audits from public,anon,authenticated;
grant select on public.ifund_sustainability_audits to authenticated;
grant insert(author_id,kind,summary,observed_at,source_url,notes,
 verification_status,transfer_bytes_observed,resource_count_observed,
 resources_missing_transfer_data) on public.ifund_sustainability_audits
 to authenticated;
create policy ifund_sustainability_admin_read
 on public.ifund_sustainability_audits for select to authenticated
 using ((select auth.jwt()->'app_metadata'->>'role') in ('admin','super_admin'));
create policy ifund_sustainability_admin_note
 on public.ifund_sustainability_audits for insert to authenticated
 with check (
  author_id=(select auth.uid())
  and (select auth.jwt()->'app_metadata'->>'role') in ('admin','super_admin')
  and verification_status in ('unverified','documented')
 );
-- The client cannot insert 'independently_verified', update statuses or
-- delete evidence. Future independent verification is a separate reviewed,
-- attributable server-side action with provenance and owner approval.
commit;
