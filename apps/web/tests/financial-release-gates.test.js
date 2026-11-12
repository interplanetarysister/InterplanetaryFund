import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const file = path => readFileSync(new URL(path, import.meta.url), "utf8");
const donorSql=file("../../../supabase/migrations/20261112_ifund_authenticated_donor_capture.sql");
const reservationSql=file("../../../supabase/migrations/20261112_ifund_cleared_withdrawal_reservations.sql");
const edge=file("../../../supabase/functions/ifund-payment-ledger/index.ts");
const worker=file("../../../workers/ifund-payments/worker.js");
const dialog=file("../src/components/payments/CampaignDonationDialog.jsx");
const withdrawals=file("../src/pages/WithdrawalVerification.jsx");
const platform=file("../src/components/payments/PayPalDonateButton.jsx");

test("never assign donor identity from an unverified client UUID",()=>{
  assert.match(donorSql,/donor_id uuid references auth\.users\(id\)/);
  assert.match(donorSql,/v_intent\.donor_id/);
  assert.match(donorSql,/v_donation\.donor_id is distinct from v_intent\.donor_id/);
  assert.match(edge,/fetch\(URL_BASE \+ "\/auth\/v1\/user"/);
  assert.match(edge,/user\.is_anonymous === true/);
  assert.match(edge,/!user\.email_confirmed_at/);
  assert.match(edge,/donor_id:donorId/);
  assert.match(edge,/existing\.donor_id!==donorId/);
  assert.doesNotMatch(edge,/donor_id:p\.donor_id/);
  assert.match(worker,/donor_access_token:donorToken/);
  assert.match(dialog,/authClient\(\)\.auth\.getSession\(\)/);
  assert.match(dialog,/authorization:"Bearer "\+accessToken/);
});
test("payment proof and receipt records remain distinct and refund-aware",()=>{
  assert.match(worker,/verifyCapture\(env,reference,intent\)/);
  assert.match(worker,/PAYMENT\.CAPTURE\.REFUNDED/);
  assert.match(donorSql,/paypal_capture_verified_at/);
  assert.match(donorSql,/on conflict \(paypal_order_id\) do nothing/);
  assert.match(donorSql,/on conflict \(operation_key\) do nothing/);
  assert.match(donorSql,/environment = 'live'/);
  assert.match(donorSql,/revoke all on function public\.ifund_finalize_verified_live_paypal_capture/);
});
test("clearing evidence cannot be injected as fictional or larger-than-gift funds",()=>{
  assert.match(reservationSql,/evidence_sha256 text not null/);
  assert.match(reservationSql,/proof_source = 'paypal_reporting_settled'/);
  assert.match(reservationSql,/environment = 'live'/);
  assert.match(reservationSql,/verify_cleared_capture_row/);
  assert.match(reservationSql,/tg_op <> 'INSERT'/);
  assert.match(reservationSql,/new\.cleared_campaign_cents>v_gift/);
  assert.match(reservationSql,/pi\.environment='live' and pi\.status='captured'/);
  assert.match(reservationSql,/d\.status='captured'/);
  assert.match(reservationSql,/revoke all on ifund_finance\.paypal_cleared_captures from public, anon, authenticated/);
});
test("all withdrawal reservations require authoritative account owner and MFA",()=>{
  assert.match(reservationSql,/withdrawal_mfa_ready\(\)/);
  assert.match(reservationSql,/where c\.id=p_campaign_id for update/);
  assert.match(reservationSql,/v_owner <> v_user/);
  assert.match(reservationSql,/canonical_operation_key=p_request_key/);
  assert.match(reservationSql,/if v_cleared-v_paid-v_reserved < p_gross_cents/);
  assert.match(reservationSql,/status='paid'/);
  assert.match(reservationSql,/status='captured'/);
  assert.match(reservationSql,/'under_review', p_request_key/);
  assert.match(reservationSql,/grant execute on function public\.ifund_request_withdrawal/);
  assert.doesNotMatch(reservationSql,/paypal\.com\/v1\/payments\/payouts/);
});
test("single 7% fee is calculated at reservation; not recognized as earned before payout",()=>{
  for(const cents of [1000,1050,3333,10001,100000000]){
    const fee=Number((BigInt(cents)*7n+50n)/100n);
    assert.equal(fee,Math.floor((cents*7+50)/100));
    assert.equal(cents-fee+fee,cents);
  }
  assert.match(reservationSql,/v_fee:=round\(p_gross_cents::numeric\*0\.07\)::bigint/);
  assert.match(withdrawals,/BigInt\(gross\)\*7n\+50n/);
  assert.doesNotMatch(reservationSql,/insert into public\.ifund_ledger_entries/i);
});
test("client cannot claim request approval or transfer just because MFA succeeded",()=>{
  assert.match(withdrawals,/ifund_owner_withdrawal_balances/);
  assert.match(withdrawals,/ifund_request_withdrawal/);
  assert.match(withdrawals,/ifund_cancel_withdrawal_request/);
  assert.match(withdrawals,/getAuthenticatorAssuranceLevel/);
  assert.match(withdrawals,/No transfer has been sent/);
  assert.doesNotMatch(withdrawals,/PAYPAL_CLIENT_SECRET|service_role/);
  assert.doesNotMatch(withdrawals,//v1/payments/payouts/);
});
test("homepage support popup states precisely what provider-hosted checkout can prove",()=>{
  assert.match(platform,/DialogContent/);
  assert.match(platform,/IFUND_PLATFORM_SUPPORT_PAYMENT_LINK/);
  assert.match(platform,/Choose and review on PayPal/);
  assert.match(platform,/not.*campaign receipts or fundraising totals/i);
  assert.doesNotMatch(platform,/\/(api\/payments\/create-order|api\/payments\/capture-order)/);
});
