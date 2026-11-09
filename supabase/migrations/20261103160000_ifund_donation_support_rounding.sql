-- SUPERSEDED: the canonical project already applied
-- 20261101215828_ifund_donations_optional_support_nearest_cent_rounding_20261101
-- and 20261105194340_ifund_donation_support_variance_20261105.
-- The live contract permits optional support up to the rounded 10% ceiling.
-- This older draft is retained as an inert migration marker; it must not
-- narrow that contract or rewrite historical donation rows.
DO $$
BEGIN
  RAISE NOTICE 'No-op: donation support constraints are owned by migrations 20261101215828 and 20261105194340.';
END;
$$;
