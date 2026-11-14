-- SOURCE-STAGED ONLY. Do not apply before independent finance/QA acceptance.
-- Atomic verified subscription events; caller MUST verify PayPal event authenticity.
-- This RPC accepts provider-verified USD/live events only. Sandbox events fail closed;
-- sandbox support requires separately reviewed isolation and accounting contracts.
ALTER TABLE public.ifund_subscription_intents
  ADD COLUMN IF NOT EXISTS last_state_event_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_state_event_rank smallint NOT NULL DEFAULT 0;
DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid='public.ifund_subscription_intents'::regclass
                   AND conname='ifund_subscription_state_rank_check') THEN
    ALTER TABLE public.ifund_subscription_intents
      ADD CONSTRAINT ifund_subscription_state_rank_check
      CHECK (last_state_event_rank BETWEEN 0 AND 2);
  END IF;
END $guard$;
ALTER TABLE public.ifund_subscription_ledger
  ADD COLUMN IF NOT EXISTS provider_resource_id text,
  ADD COLUMN IF NOT EXISTS state_applied boolean NOT NULL DEFAULT false;

-- Enforce cross-intent provider resource uniqueness at the database level.
-- Existing NULL legacy identities are deliberately excluded until reconciled.
-- A competing insert fails closed with SQLSTATE 23505; caller must not retry
-- with a different resource or fabricate a successful ledger outcome.
-- Fail closed before index creation: IF NOT EXISTS alone does not validate a
-- preexisting same-named index. No historical ledger values are disclosed.
DO $provider_index_preflight$
DECLARE
  v_duplicates bigint;
  v_index oid;
  v_valid boolean;
BEGIN
  SELECT count(*) INTO v_duplicates FROM (
    SELECT provider_resource_id, entry_type
    FROM public.ifund_subscription_ledger
    WHERE provider_resource_id IS NOT NULL
    GROUP BY provider_resource_id, entry_type HAVING count(*) > 1
  ) AS collisions;
  IF v_duplicates <> 0 THEN
    RAISE EXCEPTION 'provider resource collisions: % grouped identities', v_duplicates
      USING ERRCODE='23505';
  END IF;
  SELECT to_regclass('public.ifund_subscription_ledger_provider_resource_type_uniq') INTO v_index;
  IF v_index IS NOT NULL THEN
    SELECT i.indisunique AND i.indisvalid AND i.indisready
       AND i.indnkeyatts = 2 AND i.indnatts = 2
       AND i.indrelid = 'public.ifund_subscription_ledger'::regclass
       AND pg_get_indexdef(i.indexrelid, 1, true) = 'provider_resource_id'
       AND pg_get_indexdef(i.indexrelid, 2, true) = 'entry_type'
       AND lower(regexp_replace(coalesce(pg_get_expr(i.indpred, i.indrelid), ''),
         '[[:space:]()]', '', 'g')) = 'provider_resource_idisnotnull'
       AND i.indexprs IS NULL
      INTO v_valid
      FROM pg_catalog.pg_index i WHERE i.indexrelid = v_index;
    IF NOT coalesce(v_valid, false) THEN
      RAISE EXCEPTION 'provider resource index definition mismatch'
        USING ERRCODE='55000';
    END IF;
  END IF;
END $provider_index_preflight$;

CREATE UNIQUE INDEX IF NOT EXISTS ifund_subscription_ledger_provider_resource_type_uniq
  ON public.ifund_subscription_ledger (provider_resource_id, entry_type)
  WHERE provider_resource_id IS NOT NULL;

-- Historical intent timestamps are preserved as a conservative ordering floor.
UPDATE public.ifund_subscription_intents
SET last_state_event_at = greatest(last_payment_at, last_reversal_at),
    last_state_event_rank = CASE WHEN last_reversal_at IS NOT NULL
      AND (last_payment_at IS NULL OR last_reversal_at >= last_payment_at) THEN 2
      WHEN last_payment_at IS NOT NULL THEN 1 ELSE 0 END
WHERE last_state_event_at IS NULL AND (last_payment_at IS NOT NULL OR last_reversal_at IS NOT NULL);

CREATE OR REPLACE FUNCTION public.ifund_apply_verified_subscription_event(
  p_intent_id uuid, p_operation_key text, p_provider_resource_id text,
  p_paypal_subscription_id text, p_entry_type text, p_amount_cents bigint,
  p_occurred_at timestamptz, p_provider_reference text,
  p_verified_currency text, p_verified_environment text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE
  v_intent public.ifund_subscription_intents%ROWTYPE;
  v_existing public.ifund_subscription_ledger%ROWTYPE;
  v_rank smallint;
  v_apply boolean;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE='42501';
  END IF;
  IF p_intent_id IS NULL OR nullif(btrim(p_operation_key),'') IS NULL
     OR nullif(btrim(p_provider_resource_id),'') IS NULL
     OR nullif(btrim(p_paypal_subscription_id),'') IS NULL
     OR nullif(btrim(p_provider_reference),'') IS NULL
     OR p_occurred_at IS NULL OR p_verified_currency IS DISTINCT FROM 'USD'
     OR p_verified_environment IS DISTINCT FROM 'live'
     OR p_entry_type NOT IN ('payment','refund','reversal')
     OR p_amount_cents IS NULL OR
     (p_entry_type='payment' AND p_amount_cents<=0) OR
     (p_entry_type IN ('refund','reversal') AND p_amount_cents>=0) THEN
    RAISE EXCEPTION 'invalid verified event' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_intent FROM public.ifund_subscription_intents
    WHERE id=p_intent_id FOR UPDATE;
  IF NOT FOUND OR v_intent.paypal_subscription_id IS DISTINCT FROM p_paypal_subscription_id
     OR v_intent.currency IS DISTINCT FROM p_verified_currency THEN
    RAISE EXCEPTION 'subscription identity mismatch' USING ERRCODE='22023';
  END IF;
  -- A provider-verified payment must match the contracted intent amount.
  -- Variable-price adjustments require a separate verified contract; never
  -- silently accept a positive but different amount into the financial ledger.
  IF p_entry_type = 'payment' AND
     (v_intent.amount_cents IS NULL OR p_amount_cents <> v_intent.amount_cents) THEN
    RAISE EXCEPTION 'subscription payment amount mismatch' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_existing FROM public.ifund_subscription_ledger WHERE operation_key=p_operation_key;
  IF FOUND THEN
    IF v_existing.intent_id=p_intent_id AND
       v_existing.provider_resource_id=p_provider_resource_id AND
       v_existing.paypal_subscription_id=p_paypal_subscription_id AND
       v_existing.entry_type=p_entry_type AND v_existing.amount_cents=p_amount_cents AND
       v_existing.provider_occurred_at=p_occurred_at AND
       v_existing.provider_reference=p_provider_reference THEN RETURN 'duplicate'; END IF;
    RETURN 'conflict';
  END IF;
  -- A single provider resource may not be charged/reversed twice under different keys.
  IF EXISTS (SELECT 1 FROM public.ifund_subscription_ledger
             WHERE provider_resource_id=p_provider_resource_id AND entry_type=p_entry_type) THEN
    RETURN 'conflict';
  END IF;
  v_rank := CASE WHEN p_entry_type='payment' THEN 1 ELSE 2 END;
  v_apply := v_intent.last_state_event_at IS NULL OR
    (p_occurred_at,v_rank) > (v_intent.last_state_event_at,v_intent.last_state_event_rank);
  INSERT INTO public.ifund_subscription_ledger
    (operation_key,intent_id,member_id,paypal_subscription_id,provider_reference,
     provider_resource_id,entry_type,amount_cents,currency,environment,provider_occurred_at,state_applied)
  VALUES (p_operation_key,p_intent_id,v_intent.member_id,p_paypal_subscription_id,
          p_provider_reference,p_provider_resource_id,p_entry_type,p_amount_cents,p_verified_currency,p_verified_environment,
          p_occurred_at,v_apply);
  IF v_apply THEN
    UPDATE public.ifund_subscription_intents SET
      status=CASE WHEN p_entry_type='payment' THEN 'active' ELSE 'past_due' END,
      last_payment_at=CASE WHEN p_entry_type='payment' THEN p_occurred_at ELSE last_payment_at END,
      last_payment_cents=CASE WHEN p_entry_type='payment' THEN p_amount_cents ELSE last_payment_cents END,
      last_reversal_at=CASE WHEN p_entry_type<>'payment' THEN p_occurred_at ELSE last_reversal_at END,
      last_state_event_at=p_occurred_at,last_state_event_rank=v_rank,updated_at=now()
    WHERE id=p_intent_id;
  END IF;
  RETURN CASE WHEN v_apply THEN 'applied' ELSE 'stale_recorded' END;
END $$;
REVOKE ALL ON FUNCTION public.ifund_apply_verified_subscription_event(uuid,text,text,text,text,bigint,timestamptz,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ifund_apply_verified_subscription_event(uuid,text,text,text,text,bigint,timestamptz,text,text,text) TO service_role;
