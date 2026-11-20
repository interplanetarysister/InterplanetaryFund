-- iFund managed merchandise designer: private OWNER drafts only.
-- This migration does not enable public merchandise, checkout, Printful
-- product publication, orders, payments, or campaign ledger credits.
BEGIN;

CREATE TABLE IF NOT EXISTS public.ifund_campaign_merch_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL UNIQUE REFERENCES public.ifund_campaigns(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  design_id text NOT NULL CHECK (design_id IN ('orbit-portrait','horizon-story','mission-emblem')),
  beneficiary_display_name text NOT NULL CHECK (
    char_length(btrim(beneficiary_display_name)) BETWEEN 1 AND 72
    AND beneficiary_display_name !~ '[<>]'
  ),
  name_publication_approved_at timestamptz NOT NULL DEFAULT now(),
  artwork_rights_confirmed_at timestamptz NOT NULL DEFAULT now(),
  source_cover_url text NOT NULL DEFAULT '',
  item_kind text NOT NULL DEFAULT 'single_item' CHECK (item_kind='single_item'),
  status text NOT NULL DEFAULT 'draft' CHECK (status='draft'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ifund_campaign_merch_designs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ifund_merch_draft_owner_select ON public.ifund_campaign_merch_designs;
CREATE POLICY ifund_merch_draft_owner_select ON public.ifund_campaign_merch_designs
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.ifund_campaigns c
    WHERE c.id = campaign_id AND c.owner_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS ifund_merch_draft_owner_insert ON public.ifund_campaign_merch_designs;
CREATE POLICY ifund_merch_draft_owner_insert ON public.ifund_campaign_merch_designs
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.ifund_campaigns c
    WHERE c.id = campaign_id AND c.owner_id = (SELECT auth.uid())
  ) AND status='draft');

DROP POLICY IF EXISTS ifund_merch_draft_owner_update ON public.ifund_campaign_merch_designs;
CREATE POLICY ifund_merch_draft_owner_update ON public.ifund_campaign_merch_designs
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.ifund_campaigns c
    WHERE c.id = campaign_id AND c.owner_id = (SELECT auth.uid())
  ) AND status='draft')
  WITH CHECK (owner_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.ifund_campaigns c
    WHERE c.id = campaign_id AND c.owner_id = (SELECT auth.uid())
  ) AND status='draft');

DROP POLICY IF EXISTS ifund_merch_draft_owner_delete ON public.ifund_campaign_merch_designs;
CREATE POLICY ifund_merch_draft_owner_delete ON public.ifund_campaign_merch_designs
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.ifund_campaigns c
    WHERE c.id = campaign_id AND c.owner_id = (SELECT auth.uid())
  ));

REVOKE ALL ON public.ifund_campaign_merch_designs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ifund_campaign_merch_designs TO authenticated;

CREATE OR REPLACE FUNCTION public.ifund_merch_private_draft_owner_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.ifund_campaigns c
    WHERE c.id = NEW.campaign_id AND c.owner_id = NEW.owner_id
  ) THEN
    RAISE EXCEPTION 'Campaign merchandise owner does not match campaign owner'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$;

DROP TRIGGER IF EXISTS ifund_merch_private_draft_owner_guard_trigger
  ON public.ifund_campaign_merch_designs;
CREATE TRIGGER ifund_merch_private_draft_owner_guard_trigger
BEFORE INSERT OR UPDATE ON public.ifund_campaign_merch_designs
FOR EACH ROW EXECUTE FUNCTION public.ifund_merch_private_draft_owner_guard();

CREATE OR REPLACE FUNCTION public.ifund_merch_private_draft_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.created_at = OLD.created_at;
  NEW.name_publication_approved_at = now();
  NEW.artwork_rights_confirmed_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ifund_merch_private_draft_update ON public.ifund_campaign_merch_designs;
CREATE TRIGGER ifund_merch_private_draft_update
BEFORE UPDATE ON public.ifund_campaign_merch_designs
FOR EACH ROW EXECUTE FUNCTION public.ifund_merch_private_draft_updated_at();

COMMENT ON TABLE public.ifund_campaign_merch_designs IS
  'Private, owner-scoped, single-item merchandise design drafts. Never a public offer, paid order, or merchandise payout.';

COMMIT;
