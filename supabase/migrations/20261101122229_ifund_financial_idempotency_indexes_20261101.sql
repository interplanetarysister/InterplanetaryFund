BEGIN;

-- Canonical operation idempotency: one immutable ledger operation per key.
CREATE UNIQUE INDEX IF NOT EXISTS ifund_financial_operation_operation_key_key
  ON ifund_finance.financial_operation (operation_key);

-- A PayPal capture can enter the financial-operation ledger only once.
CREATE UNIQUE INDEX IF NOT EXISTS ifund_financial_operation_paypal_transaction_key
  ON ifund_finance.financial_operation (provider, provider_transaction_id)
  WHERE provider = 'paypal' AND provider_transaction_id IS NOT NULL;

-- Keep the financial donation mirror one-to-one with its canonical operation.
CREATE UNIQUE INDEX IF NOT EXISTS ifund_finance_donation_canonical_operation_key
  ON ifund_finance.donation (canonical_operation_id)
  WHERE canonical_operation_id IS NOT NULL;

-- Prevent a PayPal/Google Pay/Apple Pay capture from being mirrored twice.
CREATE UNIQUE INDEX IF NOT EXISTS ifund_finance_donation_paypal_transaction_key
  ON ifund_finance.donation (provider_transaction_id)
  WHERE payment_method IN ('paypal', 'googlepay', 'applepay')
    AND provider_transaction_id IS NOT NULL;

-- A holding-ledger custody event is admitted once per stable key.
CREATE UNIQUE INDEX IF NOT EXISTS ifund_holding_ledger_operation_key
  ON ifund_finance.holding_ledger_entry (operation_key);

-- Prevent the same PayPal receipt from being credited to custody twice.
CREATE UNIQUE INDEX IF NOT EXISTS ifund_holding_ledger_paypal_transaction_key
  ON ifund_finance.holding_ledger_entry (source_provider, provider_transaction_id)
  WHERE source_provider = 'paypal' AND provider_transaction_id IS NOT NULL;

-- One custody row per canonical financial operation.
CREATE UNIQUE INDEX IF NOT EXISTS ifund_holding_ledger_canonical_operation_key
  ON ifund_finance.holding_ledger_entry (canonical_operation_id)
  WHERE canonical_operation_id IS NOT NULL;

-- Webhook event keys are scoped by source and must be deduplicated atomically.
CREATE UNIQUE INDEX IF NOT EXISTS ifund_webhook_event_source_event_key
  ON ifund_finance.webhook_event (source, event_key);

COMMIT;