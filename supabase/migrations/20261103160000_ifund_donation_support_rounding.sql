-- Keep the stored optional-support rule aligned with the browser's
-- gift-first quote: round 10% of the gift to the nearest cent.
-- This migration changes only the validation constraint; it never rewrites
-- existing financial records or activates payment processing.

do $$
declare
  existing_constraint record;
begin
  -- Find the legacy table-level check by definition instead of relying on
  -- PostgreSQL's generated constraint name.
  for existing_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.ifund_donations'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%optional_support_cents%'
      and pg_get_constraintdef(oid) ilike '%gift_cents%'
  loop
    execute format(
      'alter table public.ifund_donations drop constraint %I',
      existing_constraint.conname
    );
  end loop;
end;
$$;

alter table public.ifund_donations
  add constraint ifund_donations_support_matches_gift
  check (
    optional_support_cents = 0
    or optional_support_cents = round(gift_cents::numeric / 10)::bigint
    or optional_support_cents = floor(gift_cents::numeric / 10)::bigint
  );
