-- REVIEW ONLY — not applied to the live Supabase project.
-- Align source Campaign Protocol publish gate with independent Worker.
-- Confirm all existing active rows and image URL destinations before applying.
-- Existing partial drafts must continue saving without extra fields.
--
-- apply only after reviewing the original data import and RLS, preferably
-- through a new reviewed Supabase migration created by the CLI.
alter table public.ifund_campaigns
  add constraint ifund_publish_original_cover
  check (
    status <> 'active' or
    (
      length(trim(category)) > 0 and
      length(trim(cover_image_url)) > 0 and
      cover_image_url ~ '^https://[^[:space:]]+$'
    )
  ) not valid;
-- After audit/proof:
-- alter table public.ifund_campaigns validate constraint ifund_publish_original_cover;
