BEGIN;

-- Preserve the original Campaign lifecycle enum, including completed.
ALTER TABLE public.ifund_campaigns
  DROP CONSTRAINT IF EXISTS ifund_campaigns_status_check;
ALTER TABLE public.ifund_campaigns
  ADD CONSTRAINT ifund_campaigns_status_check
  CHECK (status IN ('draft','active','paused','completed'));

-- Match the authoritative Campaign entity category enum.
ALTER TABLE public.ifund_campaigns
  ADD CONSTRAINT ifund_campaigns_category_check
  CHECK (category IN (
    'medical','emergency','education','community','animals','business',
    'memorial','disaster_relief','creative','environment','other'
  ));

-- Direct REST deletion must obey the same draft-only restriction as the Worker.
DROP POLICY IF EXISTS ifund_campaigns_delete ON public.ifund_campaigns;
CREATE POLICY ifund_campaigns_delete
  ON public.ifund_campaigns FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()) AND status = 'draft');

-- Do not let a direct authenticated UPDATE turn a published/paused/completed
-- campaign back into a draft. Normal active/paused transitions remain possible.
CREATE OR REPLACE FUNCTION public.ifund_guard_campaign_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status IN ('active','paused','completed') AND NEW.status = 'draft' THEN
    RAISE EXCEPTION 'A published campaign cannot be returned to draft.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ifund_guard_campaign_status_transition() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ifund_guard_campaign_status_transition() TO authenticated, service_role, postgres;

DROP TRIGGER IF EXISTS ifund_campaign_status_transition_guard ON public.ifund_campaigns;
CREATE TRIGGER ifund_campaign_status_transition_guard
  BEFORE UPDATE OF status ON public.ifund_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.ifund_guard_campaign_status_transition();

-- Resolve two confirmed missing covering indexes from the Supabase advisor.
CREATE INDEX IF NOT EXISTS ifund_posts_author_id_idx
  ON public.ifund_posts (author_id);
CREATE INDEX IF NOT EXISTS ifund_donations_donor_id_idx
  ON public.ifund_donations (donor_id);

COMMIT;