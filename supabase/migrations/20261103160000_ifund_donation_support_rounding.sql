-- Keep the stored optional-support rule aligned with the browser's
-- gift-first quote: round 10% of the gift to the nearest cent.
-- This migration changes only the validation constraint; it never rewrites
-- existing financial records or activates payment processing.

alter table public.ifund_donations
  drop constraint if exists ifund_donations_check;

alter table public.ifund_donations
  add constraint ifund_donations_support_matches_gift
  check (
    optional_support_cents = 0
    or optional_support_cents = round(gift_cents::numeric / 10)::bigint
    or optional_support_cents = floor(gift_cents::numeric / 10)::bigint
  );
