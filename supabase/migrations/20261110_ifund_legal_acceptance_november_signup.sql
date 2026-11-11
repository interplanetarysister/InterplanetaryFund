-- Applied to canonical Supabase project ssibsfmtodgximseeqsv on 2026-11-10.
-- Preserve historic consent receipts and permit the November policy version.
alter table public.ifund_legal_acceptances
  drop constraint if exists ifund_legal_acceptances_terms_version_check;
alter table public.ifund_legal_acceptances
  add constraint ifund_legal_acceptances_terms_version_check
  check (terms_version in ('2026-10-13-v3', '2026-11-10-v4'));
-- Existing RLS restricts inserts to owner_id = auth.uid(), active users, explicit consent.
grant insert on table public.ifund_legal_acceptances to authenticated;
