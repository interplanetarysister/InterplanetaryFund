-- Applied to canonical Supabase project ssibsfmtodgximseeqsv.
-- Campaign RLS must use the same version that the signup UI records.
create or replace function public.ifund_current_user_has_current_terms()
returns boolean
language sql stable
set search_path = ''
as $$
  select exists (
    select 1 from public.ifund_legal_acceptances as la
    where la.owner_id = (select auth.uid())
      and la.terms_version = '2026-11-10-v4'
      and la.explicit_consent is true
      and la.accepted_at is not null
  );
$$;
