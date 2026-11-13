-- Performance-only completion for verified financial foreign-key paths.
-- No row changes, grants, policy changes, or financial state transitions.
CREATE INDEX IF NOT EXISTS ifund_ledger_entries_donation_id_idx
  ON public.ifund_ledger_entries (donation_id);
CREATE INDEX IF NOT EXISTS ifund_payment_intents_donor_id_idx
  ON public.ifund_payment_intents (donor_id);
CREATE INDEX IF NOT EXISTS ifund_subscription_ledger_intent_id_idx
  ON public.ifund_subscription_ledger (intent_id);
CREATE INDEX IF NOT EXISTS ifund_paypal_payout_events_withdrawal_id_idx
  ON ifund_finance.paypal_payout_events (withdrawal_id);
CREATE INDEX IF NOT EXISTS ifund_withdrawal_approved_by_auth_uid_idx
  ON ifund_finance.withdrawal (approved_by_auth_uid);
