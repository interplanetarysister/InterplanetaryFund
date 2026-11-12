import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration=readFileSync(new URL("../../../supabase/migrations/20261112231500_ifund_refund_aware_withdrawal_journal.sql",import.meta.url),"utf8");
const worker=readFileSync(new URL("../../../workers/ifund-payments/worker.js",import.meta.url),"utf8");
const page=readFileSync(new URL("../src/pages/WithdrawalVerification.jsx",import.meta.url),"utf8");

test("partial provider refunds reduce campaign withdrawal availability",()=>{
  assert.match(migration,/paypal_refund_events/);
  assert.match(migration,/campaign_refunded_cents/);
  assert.match(migration,/Cumulative refund exceeds captured payment/);
  assert.match(migration,/cleared_campaign_cents-coalesce\(d\.campaign_refunded_cents,0\)/);
  assert.match(migration,/paypal:live:refund:/);
});

test("withdrawal reservation is atomic and journaled",()=>{
  assert.match(migration,/holding_ledger_entry/);
  assert.match(migration,/':reserve'/);
  assert.match(migration,/direction,state,source_type/);
  assert.match(migration,/'reserve','reserved','withdrawal'/);
  assert.match(migration,/canonical_reservation_id=v_hold_id::text/);
  assert.match(migration,/':release'/);
  assert.match(migration,/'release','released','withdrawal'/);
});

test("withdrawal request remains owner MFA and payout-destination gated",()=>{
  assert.match(migration,/withdrawal_mfa_ready\(\)/);
  assert.match(migration,/Campaign owner authorization required/);
  assert.match(migration,/provider='paypal_platform'/);
  assert.match(migration,/status='ready'/);
  assert.match(migration,/payouts_enabled is true/);
  assert.match(migration,/details_submitted is true/);
  assert.match(migration,/round\(p_gross_cents::numeric\*0\.07\)/);
});

test("PayPal payout readiness is read only",()=>{
  assert.match(worker,/PAYOUT_SCOPE/);
  assert.match(worker,/https:\/\/uri\.paypal\.com\/payments\/payouts/);
  assert.match(worker,/payout_webhook_ready/);
  assert.match(worker,/\/api\/payments\/payouts\/readiness/);
  assert.doesNotMatch(worker,/\/v1\/payments\/payouts"\s*,\s*"POST"/);
});

test("withdrawal UI stays fail closed while showing runtime gates",()=>{
  assert.match(page,/ifund_owner_payout_readiness/);
  assert.match(page,/Refund-adjusted balances and atomic reserve\/release accounting are enabled/);
  assert.match(page,/execution remains closed/);
  assert.doesNotMatch(page,/ifund_request_withdrawal/);
});
