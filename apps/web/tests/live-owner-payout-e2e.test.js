import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const file = path => readFileSync(new URL(path, import.meta.url), "utf8");
const payoutSql=file("../../../supabase/migrations/20261112234000_ifund_live_paypal_payout_execution.sql");
const edge=file("../../../supabase/functions/ifund-payment-ledger/index.ts");
const worker=file("../../../workers/ifund-payments/worker.js");
const owner=file("../src/pages/WithdrawalVerification.jsx");
const admin=file("../src/pages/AdminFinance.jsx");

test("owner payout destination requires verified session, AAL2, legal acceptance and explicit attestation",()=>{
  assert.match(payoutSql,/withdrawal_mfa_ready\(\)/);
  assert.match(payoutSql,/p_attest is distinct from true/);
  assert.match(payoutSql,/email_confirmed_at is not null/);
  assert.match(payoutSql,/ifund_legal_acceptances/);
  assert.match(payoutSql,/provider='paypal_platform'/);
  assert.match(owner,/I confirm/);
  assert.match(owner,/ifund_connect_paypal_payout_to_verified_email/);
});

test("payout preparation is super-admin, owner destination, refund, reservation and 7% gated",()=>{
  assert.match(payoutSql,/raw_app_meta_data->>'role',''\)='super_admin'/);
  assert.match(payoutSql,/canonical_reservation_id is null/);
  assert.match(payoutSql,/platform_fee<>round\(w\.gross_amount\*0\.07,2\)/);
  assert.match(payoutSql,/campaign_refunded_cents/);
  assert.match(payoutSql,/payouts_enabled is true/);
  assert.match(payoutSql,/details_submitted is true/);
  assert.match(payoutSql,/v_cleared < v_paid\+v_reserved/);
});

test("PayPal payout request sends only owner net with stable provider idempotency",()=>{
  assert.match(worker,/sender_batch_id:payout\.sender_batch_id/);
  assert.match(worker,/sender_item_id:payout\.sender_item_id/);
  assert.match(worker,/amount:\{currency:"USD",value:usd\(Number\(payout\.net_cents\)\)\}/);
  assert.match(worker,/purpose:"DONATIONS"/);
  assert.match(worker,/\/v1\/payments\/payouts","POST"/);
  assert.match(payoutSql,/'ifund-'\|\|replace\(w\.id::text,'-',''\)/);
});

test("provider ambiguity cannot double pay and definite failures release reservations",()=>{
  assert.match(worker,/payout_status_unknown_reconcile_before_retry/);
  assert.match(worker,/response\.status>=500\?"unknown":"failed"/);
  assert.match(payoutSql,/status='provider_status_unknown'/);
  assert.match(payoutSql,/Provider rejected payout submission before settlement/);
  assert.match(payoutSql,/':release'/);
  assert.match(payoutSql,/state='released'/);
});

test("withdrawal is paid only from provider item SUCCESS and fee is realized at settlement",()=>{
  assert.match(payoutSql,/if p_transaction_status='SUCCESS'/);
  assert.match(payoutSql,/set status='paid'/);
  assert.match(payoutSql,/Realized IFund 7% withdrawal fee/);
  assert.match(payoutSql,/w\.canonical_operation_key\|\|':payout'/);
  assert.match(payoutSql,/w\.canonical_operation_key\|\|':fee'/);
  assert.match(worker,/applyPayoutItem/);
  assert.match(worker,/cents\(amount\.value\)!==Number\(expected\.net_cents\)/);
});

test("PayPal payout webhooks are signature-gated and independently reconciled",()=>{
  assert.match(worker,/verify-webhook-signature/);
  assert.match(worker,/PAYOUT_EVENTS\.has\(kind\)/);
  assert.match(worker,/payoutItemWebhook/);
  assert.match(worker,/payoutBatchWebhook/);
  assert.match(worker,/\/v1\/payments\/payouts-item\//);
  assert.match(worker,/payout_lookup_batch/);
  assert.match(edge,/payout_state/);
});

test("browser cannot directly call PayPal payouts and super admin execution uses bearer auth",()=>{
  assert.doesNotMatch(owner,/\/v1\/payments\/payouts/);
  assert.doesNotMatch(admin,/\/v1\/payments\/payouts/);
  assert.match(admin,/\/api\/payments\/payouts\/execute/);
  assert.match(admin,/authorization:"Bearer "\+token/);
  assert.match(admin,/superAdminStatus === "super-admin"/);
});

test("service-only payout mutation RPCs are not client executable",()=>{
  for(const name of [
    "ifund_internal_prepare_paypal_payout",
    "ifund_internal_record_payout_submission",
    "ifund_internal_record_payout_submission_outcome",
    "ifund_internal_payout_lookup",
    "ifund_internal_payout_lookup_by_sender_batch",
    "ifund_internal_record_payout_state"
  ]){
    assert.match(payoutSql,new RegExp("revoke all on function public\\."+name));
  }
  assert.match(payoutSql,/grant execute on function public\.ifund_internal_prepare_paypal_payout\(uuid,uuid\) to service_role/);
});
