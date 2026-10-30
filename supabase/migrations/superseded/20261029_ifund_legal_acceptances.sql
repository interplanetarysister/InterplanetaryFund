-- SUPERSEDED by applied migration 20261030152355_ifund_legal_acceptances_owner_scoped.
-- Live table, owner RLS policies, and expanded consent fields verified 2026-10-30.
-- Retained for audit lineage only. DO NOT APPLY.

-- STAGED ONLY: independent source-aligned affirmative legal consent
-- from base44/functions/recordLegalAcceptance and TermsAcceptance.
-- Requires owner authorization and real two-account RLS tests to apply.
begin;
create table public.ifund_legal_acceptances (
  owner_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null check (terms_version='2026-10-13-v3'),
  explicit_consent boolean not null check (explicit_consent = true),
  accepted_at timestamptz not null default now(),
  primary key (owner_id,terms_version)
);
alter table public.ifund_legal_acceptances enable row level security;
revoke all on public.ifund_legal_acceptances from public,anon,authenticated;
grant select on public.ifund_legal_acceptances to authenticated;
-- User cannot forge or edit accepted_at and cannot modify someone else's
-- record. The timestamp is supplied solely by PostgreSQL.
grant insert (owner_id,terms_version,explicit_consent)
  on public.ifund_legal_acceptances to authenticated;
create policy ifund_legal_acceptance_owner_select
  on public.ifund_legal_acceptances for select to authenticated
  using (owner_id=(select auth.uid()));
create policy ifund_legal_acceptance_owner_insert
  on public.ifund_legal_acceptances for insert to authenticated
  with check (owner_id=(select auth.uid()) and explicit_consent=true);
commit;
-- Future terms updates require a reviewed new version and no silent
-- acceptance. Do not retroactively rewrite existing signed version rows.
