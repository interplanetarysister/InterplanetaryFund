import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const paid=read("../../../supabase/migrations/20261122150000_ifund_paid_monthly_50_content_credits.sql");
const agents=read("../../../supabase/migrations/20261122151000_ifund_premium_agent_unlimited_and_image_budget.sql");
const sync=read("../../../supabase/migrations/20261122152000_ifund_atomic_premium_entitlement_sync.sql");
const worker=read("../../../worker/trialAiContent.js");
const balance=read("../src/components/subscriptions/TrialCreationBalance.jsx");

test("50 paid content credits are tied to verified, unreversed $4.99 live monthly payment",()=>{
  assert.match(paid,/ifund_paid_ai_generations/);
  assert.match(paid,/v_used>=50/);
  assert.match(paid,/l\.entry_type='payment'/);
  assert.match(paid,/l\.amount_cents=499/);
  assert.match(paid,/l\.environment='live'/);
  assert.match(paid,/P-8RG59105D5286480MNMBOKJA/);
  assert.match(paid,/provider_occurred_at\+interval '1 month'/);
  assert.match(paid,/r\.parent_provider_resource_id=l\.provider_resource_id/);
  assert.match(paid,/pg_catalog\.pg_advisory_xact_lock/);
  assert.match(paid,/primary key\(owner_id,request_id\)/);
  assert.match(paid,/revoke all on public\.ifund_paid_ai_generations from public,anon,authenticated/);
  assert.match(paid,/return public\.ifund_trial_ai_generation_reserve/);
});
test("failed or duplicated generations cannot bypass monthly allowance",()=>{
  assert.match(paid,/already_completed/);
  assert.match(paid,/already_reserved/);
  assert.match(paid,/idempotency conflict/);
  assert.match(paid,/payment_id=v_payment/);
  assert.match(paid,/state='completed'/);
  assert.match(worker,/ifund_ai_content_reserve/);
  assert.match(worker,/ifund_ai_content_complete/);
  assert.match(worker,/monthly_limit/);
  assert.doesNotMatch(worker,/\["reserved","paid_or_admin_exempt"\]/);
});
test("verified Premium agent chat does not use per-day caps",()=>{
  assert.match(agents,/ifund_premium_ai_paid_payment_id\(\) is not null/);
  assert.match(agents,/if not v_unlimited and v_used>=v_limit/);
  assert.match(agents,/'unlimited',v_unlimited/);
  assert.doesNotMatch(agents,/if v_paid_used>=50 then return false/);
  assert.match(agents,/if v_total>=50 then return false/); // global Workers AI spend gate remains
});
test("subscription entitlements depend on verified receipts and are revoked after canceled/reversed status",()=>{
  assert.match(sync,/after update of status,last_payment_at,last_reversal_at/);
  assert.match(sync,/ifund_subscription_runtime\.control/);
  assert.match(sync,/v_control\.verified_merchant_id/);
  assert.match(sync,/l\.provider_merchant_id=v_control\.verified_merchant_id/);
  assert.match(sync,/ifund_access\.member_entitlements/);
  assert.match(sync,/v_payment\.provider_occurred_at\+interval '1 month'/);
  assert.match(sync,/NEW\.status in \('canceled','past_due'\)/);
  assert.match(sync,/where ifund_access\.member_entitlements\.provider='paypal'/);
});
test("paid and trial remaining credits are displayed with distinct limits",()=>{
  assert.match(balance,/ifund_ai_content_status/);
  assert.match(balance,/\[15,50\]/);
  assert.match(balance,/Premium AI creations/);
});
