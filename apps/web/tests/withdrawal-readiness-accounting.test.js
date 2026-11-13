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

test("PayPal payout readiness remains read only while execution is separately admin-gated",()=>{
  assert.match(worker,/PAYOUT_SCOPE/);
  assert.match(worker,/https:\/\/uri\.paypal\.com\/payments\/payouts/);
  assert.match(worker,/payout_webhook_ready/);
  assert.match(worker,/\/api\/payments\/payouts\/readiness/);
  assert.match(worker,/\/api\/payments\/payouts\/execute/);
  assert.match(worker,/verified_super_admin_required/);
  assert.match(worker,/payout_prepare/);
});

test("withdrawal UI stays fail closed while showing runtime gates",()=>{
  assert.match(page,/ifund_owner_payout_readiness/);
  assert.match(page,/Refund-adjusted balances and atomic reserve\/release accounting are enabled/);
  assert.match(page,/ifund_connect_paypal_payout_to_verified_email/);
  assert.match(page,/state\.payoutReady/);
  assert.match(page,/ifund_request_withdrawal/);
  assert.doesNotMatch(page,/\/v1\/payments\/payouts/);
});

test("withdrawal retry reuses operation key until acknowledgement and refreshed balance",()=>{
  assert.match(page,/useRef\(new Map\(\)\)/);
  assert.match(page,/pendingRequestKeys\.current\.get\(requestIdentity\)/);
  assert.match(page,/pendingRequestKeys\.current\.set\(requestIdentity,requestKey\)/);
  assert.match(page,/p_request_key:requestKey/);
  assert.match(page,/await refresh\(\);\s*pendingRequestKeys\.current\.delete\(requestIdentity\)/);
  assert.doesNotMatch(page,/const requestKey="wd-"\+crypto\.randomUUID\(\)/);
});

test("live donations never implicitly enable PayPal payout execution",()=>{
  const execute=worker.indexOf('if(path==="/api/payments/payouts/execute"');
  const reconcile=worker.indexOf('if(path==="/api/payments/payouts/reconcile"');
  assert.ok(execute>=0 && reconcile>execute);
  const gate=worker.slice(execute,reconcile);
  assert.match(gate,/IFUND_PAYOUT_EXECUTION_ENABLED!=="true"/);
  assert.match(gate,/payout_execution_disabled/);
  assert.ok(gate.indexOf('IFUND_PAYOUT_EXECUTION_ENABLED')<gate.indexOf('executePayout(request,env)'));
});

test("all payout submission paths independently fail closed when payouts are disabled",()=>{
  assert.match(worker,/if\(env\.IFUND_PAYOUT_EXECUTION_ENABLED!=="true"\)\s*return asJson\(\{ok:false,error:"payout_execution_disabled"\},503,cors\)/);
  assert.match(worker,/async function retryApprovedPayout\(env,withdrawalId\)/);
  assert.match(worker,/if\(env\.IFUND_PAYOUT_EXECUTION_ENABLED!=="true"\)return \{ok:false,status:"PAYOUT_EXECUTION_DISABLED"\}/);
  assert.match(worker,/if\(path==="/api\/payments\/payouts\/reconcile"&&request\.method==="POST"\)\{\s*if\(env\.IFUND_PAYOUT_EXECUTION_ENABLED!=="true"\)/);
  assert.match(worker,/if\(payout\.payout_batch_id\)return await reconcilePayoutBatch/);
});
