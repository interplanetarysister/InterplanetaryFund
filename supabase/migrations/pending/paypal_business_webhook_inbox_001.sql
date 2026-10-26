-- STAGED / NOT DEPLOYED: requires payment parity audit and authorized migration.
-- Verified PayPal events are retained even when no campaign/support/subscriber
-- mapping exists. This table DOES NOT make funds available to beneficiaries.
CREATE SCHEMA IF NOT EXISTS ifund_finance;
REVOKE ALL ON SCHEMA ifund_finance FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA ifund_finance TO service_role;

CREATE TABLE IF NOT EXISTS ifund_finance.paypal_webhook_inbox (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('sandbox','live')),
  category text NOT NULL CHECK (category IN (
    'campaign','platform_support','unattributed','capture_reconciliation',
    'subscription_reconciliation','payout_reconciliation','ignored')),
  provider_ref text,
  merchant_id text,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','reconciled','ignored')),
  deliveries integer NOT NULL DEFAULT 1 CHECK (deliveries > 0),
  received_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS paypal_inbox_status_date
 ON ifund_finance.paypal_webhook_inbox(status,received_at DESC);
ALTER TABLE ifund_finance.paypal_webhook_inbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_finance.paypal_webhook_inbox FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON ifund_finance.paypal_webhook_inbox TO service_role;
-- No RLS policy for clients: even if privileges are accidentally granted,
-- RLS denies access to all rows by default.

CREATE OR REPLACE FUNCTION public.ifund_enqueue_verified_paypal_webhook(p jsonb, raw jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event text := p->>'event_id';
  v_type text := p->>'event_type';
  v_mode text := p->>'mode';
  v_category text := p->>'category';
  v_merchant text := p->>'merchant_id';
  v_ref text := p->>'provider_ref';
  v_existing text;
BEGIN
  -- The caller MUST have verified the exact PayPal message signature
  -- using the matching webhook ID before entering this function.
  IF v_event IS NULL OR length(v_event) < 4 OR length(v_event) > 150
     OR v_type IS NULL OR length(v_type) < 8 OR length(v_type) > 120
     OR v_mode NOT IN ('sandbox','live') OR v_category NOT IN (
       'campaign','platform_support','unattributed','capture_reconciliation',
       'subscription_reconciliation','payout_reconciliation','ignored')
     OR raw IS NULL OR jsonb_typeof(raw) <> 'object'
     OR raw->>'id' IS DISTINCT FROM v_event
     OR raw->>'event_type' IS DISTINCT FROM v_type
  THEN
    RAISE EXCEPTION 'invalid verified PayPal event envelope';
  END IF;
  INSERT INTO ifund_finance.paypal_webhook_inbox
    (event_id,event_type,mode,category,merchant_id,provider_ref,payload)
  VALUES (v_event,v_type,v_mode,v_category,v_merchant,v_ref,raw)
  ON CONFLICT (event_id) DO UPDATE
    SET deliveries = ifund_finance.paypal_webhook_inbox.deliveries + 1,
        last_seen_at = now()
    WHERE ifund_finance.paypal_webhook_inbox.payload = excluded.payload
      AND ifund_finance.paypal_webhook_inbox.mode = excluded.mode;
  IF NOT FOUND THEN
    -- A repeated event identifier with different payload/mode is unsafe.
    RAISE EXCEPTION 'conflicting PayPal event ID';
  END IF;
  RETURN 'stored';
END;
$$;
REVOKE ALL ON FUNCTION public.ifund_enqueue_verified_paypal_webhook(jsonb,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ifund_enqueue_verified_paypal_webhook(jsonb,jsonb)
 TO service_role;
