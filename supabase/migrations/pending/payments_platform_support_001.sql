-- PENDING/INACTIVE: owner approval required before running anywhere.
-- Payments PR 1: IFund platform-support payments (hosted PayPal link to the
-- IFund business PayPal account). Follows the Phase 2 ifund_finance mapping:
-- private schema, RLS on, clients denied, service_role-only writes.
-- Source behavior: interplanetary-fund2 PayPalDonateButton.jsx + paypalLink.js
-- (link only, no Base44 record) and listUntrackedPayPalReceipts (receipt scan).

CREATE SCHEMA IF NOT EXISTS ifund_finance;
REVOKE ALL ON SCHEMA ifund_finance FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA ifund_finance TO service_role;

CREATE TABLE IF NOT EXISTS ifund_finance.platform_support_payment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paypal_capture_id text NOT NULL UNIQUE,
  paypal_order_id text,
  status text NOT NULL CHECK (status IN ('COMPLETED', 'PENDING', 'DENIED', 'REVERSED', 'REFUNDED', 'PARTIALLY_REFUNDED')),
  currency text,
  gross_amount numeric(12, 2),
  paypal_fee numeric(12, 2),
  net_amount numeric(12, 2),
  refunded_amount numeric(12, 2) NOT NULL DEFAULT 0,
  provider_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_support_payment_created
  ON ifund_finance.platform_support_payment (created_at DESC);

CREATE TABLE IF NOT EXISTS ifund_finance.platform_support_webhook_event (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  paypal_capture_id text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ifund_finance.platform_support_payment ENABLE ROW LEVEL SECURITY;
ALTER TABLE ifund_finance.platform_support_webhook_event ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ifund_finance.platform_support_payment FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ifund_finance.platform_support_webhook_event FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON ifund_finance.platform_support_payment TO service_role;
GRANT SELECT, INSERT ON ifund_finance.platform_support_webhook_event TO service_role;
CREATE POLICY deny_clients_platform_support_payment ON ifund_finance.platform_support_payment
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY deny_clients_platform_support_webhook_event ON ifund_finance.platform_support_webhook_event
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Called only by the Cloudflare Worker with the service-role key.
-- Idempotent on PayPal event ID; refunds accumulate; a late COMPLETED/PENDING
-- event never overwrites a refund or reversal.
CREATE OR REPLACE FUNCTION public.ifund_record_platform_support_payment(p jsonb, raw jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event text := p->>'event_id';
  v_type text := p->>'event_type';
  v_capture text := p->>'paypal_capture_id';
BEGIN
  IF coalesce(v_event, '') = '' OR coalesce(v_capture, '') = '' THEN
    RAISE EXCEPTION 'event_id and paypal_capture_id are required';
  END IF;

  INSERT INTO ifund_finance.platform_support_webhook_event (event_id, event_type, paypal_capture_id, payload)
  VALUES (v_event, v_type, v_capture, raw)
  ON CONFLICT (event_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN 'duplicate';
  END IF;

  IF v_type = 'PAYMENT.CAPTURE.REFUNDED' THEN
    -- A refund notification alone does not prove the original payment was
    -- platform support. Never create a financial row for an unknown capture.
    UPDATE ifund_finance.platform_support_payment AS t
    SET refunded_amount = t.refunded_amount + coalesce((p->>'refunded_amount')::numeric, 0),
        status = CASE
          WHEN t.gross_amount IS NOT NULL
            AND t.refunded_amount + coalesce((p->>'refunded_amount')::numeric, 0) < t.gross_amount
          THEN 'PARTIALLY_REFUNDED'
          ELSE 'REFUNDED'
        END,
        updated_at = now()
    WHERE t.paypal_capture_id = v_capture
      AND (p->>'currency' IS NULL OR t.currency = p->>'currency');
    IF NOT FOUND THEN
      -- Roll back the event claim so PayPal will retry. Otherwise an early
      -- refund would become permanently idempotent before its capture arrives.
      RAISE EXCEPTION 'unmatched platform-support refund; reconciliation required';
    END IF;
  ELSIF v_type = 'PAYMENT.CAPTURE.REVERSED' THEN
    UPDATE ifund_finance.platform_support_payment AS t
    SET status = 'REVERSED', updated_at = now()
    WHERE t.paypal_capture_id = v_capture;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'unmatched platform-support reversal; reconciliation required';
    END IF;
  ELSE
    INSERT INTO ifund_finance.platform_support_payment AS t (
      paypal_capture_id, paypal_order_id, status, currency, gross_amount, paypal_fee, net_amount, provider_created_at
    ) VALUES (
      v_capture,
      p->>'paypal_order_id',
      p->>'status',
      p->>'currency',
      (p->>'gross_amount')::numeric,
      (p->>'paypal_fee')::numeric,
      (p->>'net_amount')::numeric,
      (p->>'provider_created_at')::timestamptz
    )
    ON CONFLICT (paypal_capture_id) DO UPDATE SET
      status = CASE
        WHEN t.status IN ('REFUNDED', 'PARTIALLY_REFUNDED', 'REVERSED') AND excluded.status IN ('COMPLETED', 'PENDING', 'DENIED')
          THEN t.status
        WHEN t.status = 'COMPLETED' AND excluded.status IN ('PENDING', 'DENIED')
          THEN t.status
        ELSE excluded.status
      END,
      paypal_order_id = coalesce(excluded.paypal_order_id, t.paypal_order_id),
      currency = coalesce(excluded.currency, t.currency),
      gross_amount = coalesce(excluded.gross_amount, t.gross_amount),
      paypal_fee = coalesce(excluded.paypal_fee, t.paypal_fee),
      net_amount = coalesce(excluded.net_amount, t.net_amount),
      provider_created_at = coalesce(excluded.provider_created_at, t.provider_created_at),
      updated_at = now();
  END IF;
  RETURN 'recorded';
END;
$$;

REVOKE ALL ON FUNCTION public.ifund_record_platform_support_payment(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ifund_record_platform_support_payment(jsonb, jsonb) TO service_role;
