-- SUPERSEDED: the canonical project already applied
-- 20261105194309_ifund_public_campaign_funding_totals_20261105.
-- This older draft is retained as an inert migration marker so a future
-- migration push cannot replace the stronger live function definition.
DO $$
BEGIN
  RAISE NOTICE 'No-op: public campaign funding totals are owned by migration 20261105194309.';
END;
$$;
